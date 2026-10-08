// Offline contract tests. Compile isolated modules with the installed TypeScript;
// replace the vision boundary so no credentials or paid calls are used.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const ts = require('typescript');

function load(relative, mocks = {}) {
  const filename = path.resolve(__dirname, '..', relative);
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module = { exports: {} };
  const localRequire = createRequire(filename);
  new Function('require', 'module', 'exports', output)(
    (name) => Object.hasOwn(mocks, name) ? mocks[name] : localRequire(name),
    module, module.exports,
  );
  return module.exports;
}

const schema = load('lib/schema.ts');
const fixture = {
  category: 'electronics', brand: null, model: null, variant: null,
  identifying_marks: [], identification_confidence: 0.2,
  condition: 'unknown', condition_confidence: 0,
  missing_information: [], next_photo_request: null,
  currency: 'EUR', retail_price_new: null,
  estimated_value_low: null, estimated_value_high: null,
  price_confidence: 0, price_basis: 'unavailable', price_sources: [], reasoning_summary: [],
};
test('allows an explained general estimate without market sources', () => {
  assert.equal(schema.ObjectAnalysisSchema.safeParse({ ...fixture,
    price_basis: 'general_estimate', estimated_value_low: 5, estimated_value_high: 30,
    reasoning_summary: ['Estimation approximative fondée sur la catégorie visible.'],
  }).success, true);
});
test('rejects an unavailable result with a numeric price', () => {
  assert.equal(schema.ObjectAnalysisSchema.safeParse({ ...fixture,
    price_basis: 'unavailable', estimated_value_low: 5,
  }).success, false);
});
test('general estimates require a nonblank explanation', () => {
  assert.equal(schema.ObjectAnalysisSchema.safeParse({ ...fixture,
    price_basis: 'general_estimate', estimated_value_low: 5, estimated_value_high: 30,
    reasoning_summary: ['   '],
  }).success, false);
});
test('allows an honest result without a price', () => {
  assert.equal(schema.ObjectAnalysisSchema.safeParse(fixture).success, true);
});
test('rejects a priced result without evidence', () => {
  assert.equal(schema.ObjectAnalysisSchema.safeParse({
    ...fixture, estimated_value_low: 100, estimated_value_high: 200,
  }).success, false);
});
test('rejects negative and reversed price ranges', () => {
  assert.equal(schema.ObjectAnalysisSchema.safeParse({
    ...fixture, estimated_value_low: 200, estimated_value_high: -1,
  }).success, false);
});
test('rejects non-web source URLs', () => {
  assert.equal(schema.PriceSourceSchema.safeParse({
    title: 'Synthetic test', url: 'javascript:alert(1)', price: 10,
    currency: 'EUR', price_type: 'marketplace_asking',
  }).success, false);
});

// Mechanical addition, not a test-strategy change: route.ts gained new lib
// dependencies (image byte validation, rate limiting, error classification)
// that this offline harness must resolve like it already does for
// schema/vision — loaded for real (not faked) so the route tests below
// exercise the actual logic.
const imageValidation = load('lib/imageValidation.ts');
const rateLimit = load('lib/rateLimit.ts');
const errors = load('lib/errors.ts');

function route() {
  let calls = 0;
  const handler = load('app/api/analyze/route.ts', {
    '@/lib/schema': schema,
    '@/lib/imageValidation': imageValidation,
    '@/lib/rateLimit': rateLimit,
    '@/lib/errors': errors,
    '@/lib/vision': { analyzeObject: async () => {
      calls++;
      return { analysis: fixture, researchNotes: 'Synthetic offline fixture' };
    } },
  });
  return { post: (body) => handler.POST({ json: async () => body }), calls: () => calls };
}
test('null JSON returns 400 without calling vision', async () => {
  const r = route();
  assert.equal((await r.post(null)).status, 400);
  assert.equal(r.calls(), 0);
});
test('third photo is rejected without calling vision', async () => {
  const r = route();
  assert.equal((await r.post({ images: Array(3).fill({ mediaType: 'image/jpeg', data: 'fake' }) })).status, 400);
  assert.equal(r.calls(), 0);
});
test('invalid image bytes never reach the paid provider', async () => {
  const r = route();
  assert.equal((await r.post({ images: [{ mediaType: 'image/jpeg', data: 'not an image!' }] })).status, 400);
  assert.equal(r.calls(), 0);
});

test('a source without any observed price cannot support a valuation', () => {
  assert.equal(schema.ObjectAnalysisSchema.safeParse({
    ...fixture, estimated_value_low: 100, estimated_value_high: 200,
    price_sources: [{ title: 'Synthetic source', url: 'https://example.com/item',
      price: null, currency: 'EUR', price_type: 'marketplace_asking' }],
  }).success, false);
});

test('a truncated JPEG signature is not a usable image', () => {
  assert.equal(imageValidation.isValidImagePayload('image/jpeg',
    Buffer.from([0xff, 0xd8, 0xff]).toString('base64')), false);
});

test('padding between JPEG markers does not make a decodable image', () => {
  const bytes = Buffer.alloc(128);
  bytes.set([0xff, 0xd8, 0xff]);
  bytes.set([0xff, 0xd9], 126);
  assert.equal(imageValidation.isValidImagePayload('image/jpeg', bytes.toString('base64')), false);
});

test('a negative source price cannot support a positive valuation', () => {
  assert.equal(schema.ObjectAnalysisSchema.safeParse({
    ...fixture, estimated_value_low: 100, estimated_value_high: 200,
    price_sources: [{ title: 'Synthetic source', url: 'https://example.com/item',
      price: -10, currency: 'EUR', price_type: 'marketplace_asking' }],
  }).success, false);
});

test('requests denied by the per-IP quota do not exhaust the shared allowance', () => {
  const limiter = load('lib/rateLimit.ts');
  for (let i = 0; i < 10; i++) assert.equal(limiter.checkRateLimit('client-a').ok, true);
  for (let i = 0; i < 190; i++) assert.equal(limiter.checkRateLimit('client-a').ok, false);
  assert.equal(limiter.checkRateLimit('client-b').ok, true);
});

test('analytics strips unknown fields and string payloads', async () => {
  const handler = load('app/api/event/route.ts');
  const original = console.log;
  const captured = [];
  console.log = (...args) => captured.push(args);
  try {
    const response = await handler.POST({ json: async () => ({
      name: 'scan_started', photo: 'synthetic-private-value',
      props: { round: 1, arbitrary: 'synthetic-private-value', rounds: 'secret' },
    }) });
    assert.equal(response.status, 200);
    assert.deepEqual(JSON.parse(captured[0][1]).props, { round: 1 });
    assert.equal(JSON.stringify(captured).includes('synthetic-private-value'), false);
  } finally { console.log = original; }
});

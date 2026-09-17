// Regenerates lib/game/items.ts by running real photos through the actual
// analyzeObject pipeline (lib/vision.ts) — the game's reference prices come
// from the same identification+pricing engine the product itself uses, not
// a hand-curated or invented answer key. Run with a real ANTHROPIC_API_KEY;
// this makes real, billed API calls.
//
// Usage: node --env-file=.env.local scripts/generate-game-data.cjs
//
// Edit PHOTOS below to add/replace items, then re-run and commit the
// resulting lib/game/items.ts.

const fs = require("node:fs");
const path = require("node:path");
const { createRequire } = require("node:module");
const ts = require("typescript");

function load(relative, mocks = {}) {
  const filename = path.resolve(__dirname, "..", relative);
  const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const mod = { exports: {} };
  const localRequire = createRequire(filename);
  new Function("require", "module", "exports", output)(
    (name) => (Object.hasOwn(mocks, name) ? mocks[name] : localRequire(name)),
    mod,
    mod.exports,
  );
  return mod.exports;
}

const schema = load("lib/schema.ts");
const anthropicMod = load("lib/anthropic.ts");
const prompts = load("lib/prompts.ts");
const vision = load("lib/vision.ts", {
  "./schema": schema,
  "./anthropic": anthropicMod,
  "./prompts": prompts,
});

// id, a local file under a temp photos dir, and the credit required by
// Wikimedia Commons for reuse (CC/public domain images still need
// attribution — this is not the same question as usage-rights for the
// price data itself, which comes from our own pipeline, not from Commons).
const PHOTOS_DIR = process.env.GAME_PHOTOS_DIR || "/tmp/game_photos";
const PHOTOS = [
  { id: "camera", file: "camera.jpg", credit: "Vintage Yashica FX-2, Joe Haupt, Wikimedia Commons, CC BY-SA" },
  { id: "espresso", file: "espresso.jpg", credit: "Rocket espresso machine, Wikimedia Commons" },
  { id: "skateboard", file: "skateboard.jpg", credit: "Nash vintage wooden shark deck skateboard, Wikimedia Commons" },
  { id: "chair", file: "chair.jpg", credit: "Eames Lounge Chair, Wikimedia Commons" },
  { id: "handbag", file: "handbag.jpg", credit: "Louis Vuitton bag, Wikimedia Commons" },
  { id: "watch2", file: "watch2.jpg", credit: "Rolex Submariner diving watch, Wikimedia Commons" },
];

function fileToImageInput(filePath) {
  const data = fs.readFileSync(filePath).toString("base64");
  return { mediaType: "image/jpeg", data };
}

const outPathDefault = path.resolve(__dirname, "..", "lib", "game", "items.generated.json");

function loadExisting() {
  try {
    return JSON.parse(fs.readFileSync(outPathDefault, "utf8"));
  } catch {
    return [];
  }
}

async function main() {
  // Skip re-paying for items already generated successfully in a prior run
  // (e.g. after swapping out only the photos that didn't work) — pass
  // FORCE_REGENERATE=1 to ignore this and redo everything.
  const existing = process.env.FORCE_REGENERATE ? [] : loadExisting();
  const existingById = new Map(existing.map((item) => [item.id, item]));

  const results = [];
  for (const photo of PHOTOS) {
    const cached = existingById.get(photo.id);
    if (cached) {
      console.log(`Reusing existing result for ${photo.id} (set FORCE_REGENERATE=1 to redo)`);
      results.push(cached);
      continue;
    }
    const filePath = path.join(PHOTOS_DIR, photo.file);
    if (!fs.existsSync(filePath)) {
      console.error(`Skipping ${photo.id}: ${filePath} not found`);
      continue;
    }
    console.log(`Analyzing ${photo.id}...`);
    const image = fileToImageInput(filePath);
    try {
      // round === maxRounds: force a final best-effort answer, no follow-up
      // photo request — the game needs a ready answer, not a conversation.
      const { analysis } = await vision.analyzeObject([image], 1, 1);
      results.push({ ...photo, analysis });
      console.log(`  -> ${analysis.brand ?? ""} ${analysis.model ?? analysis.category} | retail=${analysis.retail_price_new} range=[${analysis.estimated_value_low},${analysis.estimated_value_high}] confidence=${analysis.price_confidence}`);
    } catch (err) {
      // One bad item (e.g. a malformed URL the schema rejects, a transient
      // API error) shouldn't lose the rest of the batch's real, paid work.
      console.error(`  -> FAILED for ${photo.id}: ${err.message}`);
    }
  }

  const usable = results.filter(
    (r) => r.analysis.retail_price_new !== null || r.analysis.estimated_value_low !== null || r.analysis.estimated_value_high !== null,
  );
  const dropped = results.filter((r) => !usable.includes(r));
  if (dropped.length > 0) {
    console.log(`\nDropping ${dropped.length} item(s) with no price at all (nothing to score a guess against): ${dropped.map((d) => d.id).join(", ")}`);
  }

  fs.mkdirSync(path.dirname(outPathDefault), { recursive: true });
  fs.writeFileSync(outPathDefault, JSON.stringify(usable, null, 2));
  console.log(`\nWrote ${usable.length} items to ${outPathDefault}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

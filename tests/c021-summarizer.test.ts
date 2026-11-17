// Contre-vérification CL023 : vraie adaptation SDK, réponses HTTP entièrement simulées.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createClaudeSummarizer } from '../lib/actus/claude-summarizer.ts';
import { SummarizeError } from '../lib/actus/synthesis.ts';

const input = { title: 'Fixture', source: 'Fixture', url: 'https://example.test/article', text: 'Texte fictif.' };
for (const [label, stop, text] of [
  ['réponse tronquée', 'max_tokens', '{}'],
  ['JSON invalide', 'end_turn', 'invalide'],
] as const) {
  test(`C021 : coût de la ${label} conservé depuis la réponse SDK`, async () => {
    let calls = 0;
    const summarize = createClaudeSummarizer({
      apiKey: 'fixture-not-a-secret',
      fetch: async () => {
        calls++;
        return new Response(JSON.stringify({
          id: 'msg_fixture', type: 'message', role: 'assistant', model: 'claude-haiku-5-5',
          content: [{ type: 'text', text }], stop_reason: stop, stop_sequence: null,
          usage: { input_tokens: 1000, output_tokens: 100 },
        }), { status: 200, headers: { 'content-type': 'application/json' } });
      },
    });
    await assert.rejects(summarize(input), e => e instanceof SummarizeError && e.costMicros === 150);
    assert.equal(calls, 1);
  });
}

test('C021 : une réponse HTTP 500 ne provoque aucune relance interne du SDK', async () => {
  let calls = 0;
  const summarize = createClaudeSummarizer({
    apiKey: 'fixture-not-a-secret',
    fetch: async () => {
      calls++;
      return new Response(JSON.stringify({ type: 'error', error: { type: 'api_error', message: 'Fixture' } }), {
        status: 500, headers: { 'content-type': 'application/json' },
      });
    },
  });
  await assert.rejects(summarize(input));
  assert.equal(calls, 1);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeUrl, parseHttpUrl } from "../lib/urls.ts";

test("deux écritures d'une même page donnent la même forme normalisée", () => {
  const a = normalizeUrl("https://www.Example.com/article/?utm_source=x&b=2&a=1#section");
  const b = normalizeUrl("http://example.com/article?a=1&b=2&fbclid=123");
  assert.equal(a, "example.com/article?a=1&b=2");
  assert.equal(a, b);
});

test("des pages différentes restent distinctes", () => {
  assert.notEqual(normalizeUrl("https://example.com/a"), normalizeUrl("https://example.com/b"));
  assert.notEqual(normalizeUrl("https://example.com/a?id=1"), normalizeUrl("https://example.com/a?id=2"));
});

test("seules les adresses http(s) absolues sont acceptées", () => {
  assert.equal(parseHttpUrl("javascript:alert(1)"), null);
  assert.equal(parseHttpUrl("data:text/html,<b>x</b>"), null);
  assert.equal(parseHttpUrl("/relative"), null);
  assert.equal(parseHttpUrl("https://user:pass@example.com"), null);
  assert.equal(parseHttpUrl("http://localhost"), null);
  assert.ok(parseHttpUrl("https://arxiv.org/abs/2401.00001"));
});

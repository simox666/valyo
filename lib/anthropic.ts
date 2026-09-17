import Anthropic from "@anthropic-ai/sdk";

export const anthropic = new Anthropic();

// Phase A (identification + web research) drives most of a scan's latency
// and cost. Opus gave the best reasoning/vision quality but was too slow in
// practice (real scans running 100-170s+) — Sonnet is markedly faster while
// still strong at identification + search-and-extract, which is most of
// what this step actually does. Phase B is pure schema formatting of text
// Phase A already produced, so a much cheaper/faster model is sufficient
// there. Change here to tune the cost/quality/speed tradeoff per scan.
export const RESEARCH_MODEL = "claude-sonnet-5";
export const EXTRACTION_MODEL = "claude-haiku-4-5";

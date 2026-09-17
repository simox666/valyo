import Anthropic from "@anthropic-ai/sdk";

export const anthropic = new Anthropic();

// Phase A (identification + web research) needs the strongest available
// reasoning and vision quality — this is the step that decides whether the
// product is honest about what it doesn't know. Phase B is pure schema
// formatting of text Phase A already produced, so a much cheaper model is
// sufficient there. Change here to tune the cost/quality tradeoff per scan.
export const RESEARCH_MODEL = "claude-opus-5";
export const EXTRACTION_MODEL = "claude-haiku-4-5";

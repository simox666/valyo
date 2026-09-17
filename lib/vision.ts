import type Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { anthropic, RESEARCH_MODEL, EXTRACTION_MODEL } from "./anthropic";
import { ObjectAnalysisSchema, type ObjectAnalysis } from "./schema";
import { researchSystemPrompt, extractionSystemPrompt } from "./prompts";
import type { ImageInput } from "./types";

export interface AnalyzeResult {
  analysis: ObjectAnalysis;
  researchNotes: string;
}

const MAX_TOOL_ITERATIONS = 5;
// maxDuration on the route is a hosting declaration, not a pipeline
// timeout — nothing stopped a hung SDK call from running (and being billed)
// well past it. This is the real deadline, propagated as an AbortSignal
// into every SDK call, combined with the inbound request's own signal so a
// client disconnect actually cancels the upstream work too (project.md C5).
const SERVER_TIMEOUT_MS = 110_000;

function requestSignal(external?: AbortSignal): AbortSignal {
  const timeoutSignal = AbortSignal.timeout(SERVER_TIMEOUT_MS);
  return external ? AbortSignal.any([external, timeoutSignal]) : timeoutSignal;
}

export async function analyzeObject(
  images: ImageInput[],
  round: number,
  maxRounds: number,
  correctionNote?: string,
  externalSignal?: AbortSignal,
): Promise<AnalyzeResult> {
  const signal = requestSignal(externalSignal);

  const imageBlocks: Anthropic.ImageBlockParam[] = images.map((img) => ({
    type: "image",
    source: { type: "base64", media_type: img.mediaType, data: img.data },
  }));

  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: [
        ...imageBlocks,
        {
          type: "text",
          text:
            round === 1
              ? "Here is the photo of the item. Identify it, assess its condition, and research its value."
              : "Here is the original photo plus the additional photo that was requested. Identify the item, assess its condition, and research its value.",
        },
      ],
    },
  ];

  // Server tools (web_search) run on Anthropic's infrastructure and can
  // return pause_turn if a turn does a lot of searching — resume by
  // re-sending the assistant turn, matching the documented manual-loop
  // pattern for server tools.
  let researchNotes = "";
  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const response = await anthropic.messages.create(
      {
        model: RESEARCH_MODEL,
        max_tokens: 4000,
        system: researchSystemPrompt(round, maxRounds, correctionNote),
        tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 2 }],
        output_config: { effort: "medium" },
        messages,
      },
      { signal },
    );

    const textBlocks = response.content.filter(
      (b): b is Anthropic.TextBlock => b.type === "text",
    );
    researchNotes = textBlocks.map((b) => b.text).join("\n");

    if (response.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: response.content });
      continue;
    }

    break;
  }

  if (!researchNotes.trim()) {
    throw new Error("No findings were produced for this photo.");
  }

  const extraction = await anthropic.messages.parse(
    {
      model: EXTRACTION_MODEL,
      max_tokens: 4096,
      system: extractionSystemPrompt,
      messages: [{ role: "user", content: researchNotes }],
      output_config: { format: zodOutputFormat(ObjectAnalysisSchema) },
    },
    { signal },
  );

  if (!extraction.parsed_output) {
    throw new Error("Could not structure the analysis output.");
  }

  return { analysis: extraction.parsed_output, researchNotes };
}

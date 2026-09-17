import Anthropic from "@anthropic-ai/sdk";

// Closed set of categories — never the raw provider error message. A raw
// SDK error's .message can embed request/response details we don't control
// and don't want in shared logs (project.md C6). Pair with a diagnosticId
// so a specific failure can still be correlated/reported without exposing
// what the provider actually said.
export type ErrorCategory =
  | "rate_limited"
  | "auth_error"
  | "bad_request"
  | "network_error"
  | "provider_error"
  | "timeout"
  | "no_findings"
  | "structuring_failed"
  | "schema_validation_failed"
  | "unknown_error";

export function classifyProviderError(err: unknown): ErrorCategory {
  // Checked first: the SDK's structured-output parser can throw (rather than
  // returning parsed_output: null) when the model's JSON fails our schema —
  // lib/vision.ts already retries this once, so seeing it here means the
  // retry also failed. Distinct from a generic provider_error so this
  // specific failure mode (vs. a real API outage) is visible in logs.
  if (err instanceof Error && /failed to parse structured output/i.test(err.message)) {
    return "schema_validation_failed";
  }
  if (err instanceof Anthropic.RateLimitError) return "rate_limited";
  if (err instanceof Anthropic.AuthenticationError) return "auth_error";
  if (err instanceof Anthropic.BadRequestError) return "bad_request";
  if (err instanceof Anthropic.APIConnectionError) return "network_error";
  if (err instanceof Anthropic.APIError) return "provider_error";
  if (err instanceof Error && err.name === "AbortError") return "timeout";
  if (err instanceof Error && err.message === "No findings were produced for this photo.") return "no_findings";
  if (err instanceof Error && err.message === "Could not structure the analysis output.") return "structuring_failed";
  return "unknown_error";
}

export function newDiagnosticId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

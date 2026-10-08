import { Resend } from "resend";

// Resend's shared test domain (onboarding@resend.dev) can only deliver to
// the Resend account's own verified address — fine for development, but a
// real magic link to a friend's inbox needs a verified sending domain
// (project.md: a subdomain of valyo.si, once the rest of this feature is
// confirmed working).
const FROM_ADDRESS = process.env.RESEND_FROM_ADDRESS || "Valyo <onboarding@resend.dev>";

function client(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not set");
  return new Resend(apiKey);
}

export async function sendMagicLinkEmail(to: string, subject: string, text: string): Promise<void> {
  await client().emails.send({ from: FROM_ADDRESS, to, subject, text });
}

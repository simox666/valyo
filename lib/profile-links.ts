// Liens de profil reconnus : nom affiché à partir de l'adresse (GitHub, ORCID, Google Scholar…).

const KNOWN: [RegExp, string][] = [
  [/(^|\.)github\.com$/, "GitHub"],
  [/(^|\.)gitlab\.com$/, "GitLab"],
  [/(^|\.)orcid\.org$/, "ORCID"],
  [/^scholar\.google\./, "Google Scholar"],
  [/(^|\.)arxiv\.org$/, "arXiv"],
  [/(^|\.)huggingface\.co$/, "Hugging Face"],
  [/(^|\.)bsky\.app$/, "Bluesky"],
  [/(^|\.)linkedin\.com$/, "LinkedIn"],
  [/(^|\.)researchgate\.net$/, "ResearchGate"],
  [/(^|\.)(mastodon\.[a-z.]+|mstdn\.[a-z.]+|fosstodon\.org|piaille\.fr)$/, "Mastodon"],
  [/(^|\.)youtube\.com$|^youtu\.be$/, "YouTube"],
  [/(^|\.)substack\.com$/, "Substack"],
];

export function linkLabel(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    for (const [re, label] of KNOWN) if (re.test(host)) return label;
    return host;
  } catch {
    return url;
  }
}

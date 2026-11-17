import { z } from "zod";
import { parseHttpUrl } from "./urls";

const RESERVED_HANDLES = new Set([
  "admin", "administrateur", "agent", "agent-editorial", "moderateur", "moderation", "valyo", "support", "aide", "systeme",
]);

export const handleSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,24}$/, "3 à 24 caractères : lettres minuscules sans accent, chiffres ou _.")
  .refine((h) => !RESERVED_HANDLES.has(h), "Ce pseudonyme est réservé.");

export const displayNameSchema = z.string().trim().min(1, "Indiquez un nom affiché.").max(50, "50 caractères maximum.");
export const bioSchema = z.string().trim().max(280, "280 caractères maximum.");

const httpUrl = z
  .string()
  .trim()
  .max(2000, "Adresse trop longue.")
  .refine((v) => parseHttpUrl(v) !== null, "Adresse web invalide (elle doit commencer par https://).");

export const onboardingSchema = z.object({
  handle: handleSchema,
  displayName: displayNameSchema,
  acceptRules: z.literal(true, { error: "Vous devez accepter les règles de la communauté." }),
  themeIds: z.array(z.uuid()).max(20).default([]),
});

const shortText = (max: number) => z.string().trim().max(max, `${max} caractères maximum.`);

export const profileSchema = z.object({
  displayName: displayNameSchema,
  bio: bioSchema,
  themeIds: z.array(z.uuid()).max(20),
  // Champs absents : valeur actuelle conservée ; photo à null : retirée.
  headline: shortText(80).optional(),
  specialties: z.array(z.string().trim().min(1).max(30, "30 caractères maximum par spécialité.")).max(8, "8 spécialités maximum.").optional(),
  links: z.array(httpUrl).max(6, "6 liens maximum.").optional(),
  askMe: shortText(160).optional(),
  lookingFor: shortText(160).optional(),
  avatarImageId: z.uuid().nullable().optional(),
  bannerImageId: z.uuid().nullable().optional(),
});

export const POST_KINDS = ["news", "question", "experience"] as const;
export type PostKind = (typeof POST_KINDS)[number];

export const KIND_LABELS: Record<PostKind, string> = {
  news: "Actualité",
  question: "Question",
  experience: "Retour d’expérience",
};

export const postSchema = z
  .object({
    kind: z.enum(POST_KINDS, { error: "Choisissez un type de publication." }),
    title: z.string().trim().min(5, "Le titre doit faire au moins 5 caractères.").max(200, "200 caractères maximum."),
    // Facultatif : une publication peut tenir en une phrase (publication rapide depuis le fil).
    body: z.string().trim().max(10000, "10 000 caractères maximum.").default(""),
    sources: z.array(httpUrl).max(5, "5 sources maximum.").default([]),
    themeIds: z.array(z.uuid()).min(1, "Choisissez au moins un thème.").max(3, "3 thèmes maximum."),
    demoUrl: z.union([httpUrl, z.literal("")]).optional(),
    // Photos déjà envoyées (/api/uploads), rattachées à la création.
    imageIds: z.array(z.uuid()).max(4, "4 photos maximum.").default([]),
    // Confirmation explicite après l'avertissement de doublon (F04).
    allowDuplicate: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.kind === "question" && value.demoUrl) {
      ctx.addIssue({ code: "custom", path: ["demoUrl"], message: "Un lien de test n'est pas prévu pour une question." });
    }
  });

export type PostInput = z.infer<typeof postSchema>;

export const commentSchema = z.object({
  body: z.string().trim().min(1, "Le commentaire est vide.").max(5000, "5 000 caractères maximum."),
  parentId: z.uuid().optional(),
});

export const commentEditSchema = z.object({
  body: z.string().trim().min(1, "Le commentaire est vide.").max(5000, "5 000 caractères maximum."),
});

/** Erreurs de validation par champ, pour signaler précisément le champ à corriger. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? String(issue.path[0]) : "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

import "server-only";
import { Resend } from "resend";

const FROM = process.env.RESEND_FROM_ADDRESS || "Valyo <onboarding@resend.dev>";

/**
 * Envoie le lien de connexion. Sans clé Resend, et seulement hors production,
 * le lien est écrit dans le terminal du serveur et renvoyé pour l'afficher
 * comme lien de développement clairement identifié. En production, l'absence
 * de clé est une erreur : on ne prétend jamais avoir envoyé un e-mail.
 */
async function sendLink(to: string, link: string, appeal: boolean): Promise<{ devLink?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV === "production") throw new Error("RESEND_API_KEY n'est pas configurée.");
    console.info(`[dev] Lien de connexion pour ${to} : ${link}`);
    return { devLink: link };
  }
  const { error } = await new Resend(apiKey).emails.send({
    from: FROM,
    to,
    subject: appeal ? "Contester une sanction sur Valyo" : "Votre lien de connexion à Valyo",
    text: appeal ? `Bonjour,\n\nCe lien permet uniquement de consulter et contester vos sanctions pendant 60 minutes, sans ouvrir de session Valyo :\n\n${link}\n\nIl est consommé après le dépôt d’une contestation. Si vous n’avez rien demandé, ignorez ce message.` : `Bonjour,\n\nPour vous connecter à Valyo, ouvrez ce lien (valable 15 minutes, utilisable une seule fois) :\n\n${link}\n\nSi vous n'avez rien demandé, ignorez simplement ce message.`,
  });
  if (error) throw new Error(`Envoi de l'e-mail impossible : ${error.message}`);
  return {};
}

export const sendLoginLink = (to: string, link: string) => sendLink(to, link, false);
export const sendAppealLink = (to: string, link: string) => sendLink(to, link, true);

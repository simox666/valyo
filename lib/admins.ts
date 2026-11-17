/** Résolution partagée par authentification, décisions et notifications administratives. */
export function configuredAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean);
}

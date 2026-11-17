// Enregistrement d'un jour actif par membre (indicateur decisions.md §5).
// Module sans dépendance serveur, testé dans tests/activity.test.ts.
//
// Anomalie A003 : une panne de mesure ne doit jamais faire échouer une page.
// L'erreur est journalisée et avalée ; le membre n'est mis en cache qu'après
// une écriture réussie, pour que la requête suivante réessaie.

export type ActivityWriter = (userId: string, utcDay: string) => Promise<unknown>;

export function createActivityRecorder(write: ActivityWriter, now: () => Date = () => new Date()) {
  let cache = { day: "", ids: new Set<string>() };
  return async function recordActivity(userId: string): Promise<void> {
    // Jour UTC, comme dans les requêtes d'indicateurs (anomalie A004).
    const day = now().toISOString().slice(0, 10);
    if (cache.day !== day) cache = { day, ids: new Set() };
    if (cache.ids.has(userId)) return;
    try {
      await write(userId, day);
      cache.ids.add(userId);
    } catch (error) {
      console.error("[indicateurs] jour d'activité non enregistré", error);
    }
  };
}

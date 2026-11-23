// Démarrage du serveur web : lance la boucle d'envoi des notifications push et le
// nettoyage périodique des enregistrements vocaux qui n'ont plus de message.
// (Le worker éditorial est un autre processus et ne passe pas par ici.)
// L'import reste DANS la condition : c'est ce qui l'exclut du paquet « edge », où `fs` n'existe pas.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startPushLoop } = await import("./lib/push/send");
    startPushLoop();
    const { startAudioSweep } = await import("./lib/rooms/audio-sweep");
    startAudioSweep();
  }
}

import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-16 bg-paper">
      <div className="w-full max-w-md text-center space-y-8">
        <div className="space-y-3">
          <h1 className="text-4xl font-semibold text-ink">Combien ça vaut ?</h1>
          <p className="text-neutral-600">
            Prenez une photo. Valyo identifie l&apos;objet et estime ce qu&apos;il pourrait
            valoir en seconde main.
          </p>
        </div>

        <div className="space-y-3">
          <Link href="/scan" className="block w-full rounded-full bg-ink text-white py-4 font-medium">
            Prendre une photo
          </Link>
          <Link
            href="/scan"
            className="block w-full rounded-full border border-neutral-300 text-ink py-4 font-medium"
          >
            Importer une photo
          </Link>
        </div>

        <p className="text-sm text-neutral-500">
          N&apos;importe quel objet — si on ne trouve pas assez d&apos;indices pour l&apos;estimer
          honnêtement, on vous le dit.
        </p>

        <p className="text-xs text-neutral-400">
          Pas d&apos;invention. Valyo indique toujours d&apos;où viennent ses estimations et sa
          confiance dans le résultat.
        </p>

        <Link
          href="/game"
          className="block w-full rounded-full bg-neutral-100 text-ink py-4 font-medium"
        >
          Jouer à &laquo; Devine le prix &raquo;
        </Link>
      </div>
    </main>
  );
}

import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card p-6 text-center">
      <h1 className="text-xl font-bold">Page introuvable</h1>
      <p className="mt-2 text-soft">Ce lien ne mène à rien, ou le contenu n’existe plus.</p>
      <Link href="/" className="btn-secondary mt-4">
        Retour au fil
      </Link>
    </div>
  );
}

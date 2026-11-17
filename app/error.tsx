"use client";

import Link from "next/link";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="card p-6 text-center" role="alert">
      <h1 className="text-xl font-bold">Un problème est survenu</h1>
      <p className="mt-2 text-neutral-600">La page n’a pas pu être chargée. Réessayez dans un instant.</p>
      <div className="mt-4 flex justify-center gap-2">
        <button type="button" className="btn-primary" onClick={reset}>
          Réessayer
        </button>
        <Link href="/" className="btn-secondary">
          Retour au fil
        </Link>
      </div>
    </div>
  );
}

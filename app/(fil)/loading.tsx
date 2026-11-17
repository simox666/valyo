export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="space-y-3">
      <span className="sr-only">Chargement…</span>
      {[0, 1, 2].map((i) => (
        <div key={i} className="card h-32 animate-pulse bg-white" />
      ))}
    </div>
  );
}

export default function PagePlaceholder({ title, phase, description }) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center">
      <span className="inline-block rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand">
        {phase}
      </span>
      <h1 className="mt-4 text-2xl font-bold text-gray-900">{title}</h1>
      {description && <p className="mt-2 text-gray-500">{description}</p>}
      <p className="mt-6 text-sm text-gray-400">
        Route is wired and reachable — full page build lands in the phase noted above.
      </p>
    </div>
  );
}

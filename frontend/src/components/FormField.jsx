export default function FormField({ label, error, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
      {children}
      {error && <span className="mt-1 block text-sm text-red-600">{error}</span>}
    </label>
  );
}

// text-base (16px), not text-sm — iOS Safari auto-zooms the whole page
// when a focused input's font-size is under 16px, which feels broken on
// every text field in the app (every page using inputClass, i.e. most
// forms) if left at the smaller size.
export const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-base shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";

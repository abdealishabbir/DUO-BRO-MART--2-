import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <h1 className="text-3xl font-bold text-gray-900">Page not found</h1>
      <p className="mt-2 text-gray-500">That page doesn&apos;t exist.</p>
      <Link to="/" className="mt-6 inline-block text-brand hover:underline">
        Back to home
      </Link>
    </div>
  );
}

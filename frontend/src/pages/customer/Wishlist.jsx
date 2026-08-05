import Meta from "../../components/Meta.jsx";
import { Link } from "react-router-dom";
import { Heart } from "lucide-react";

export default function Wishlist() {
  return (
    <>
      <Meta
        title="Wishlist"
        description="View the products you saved for later on Duo Bro Mart."
        url={`${window.location.origin}/wishlist`}
      />
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="mx-auto max-w-md text-center">
        <Heart className="mx-auto h-12 w-12 text-gray-300" />
        <h1 className="mt-4 text-xl font-bold text-gray-900">Your wishlist</h1>
        <p className="mt-2 text-sm text-gray-500">You haven&apos;t saved any items yet. Browse the shop to add favorites.</p>
        <Link to="/shop" className="mt-6 inline-flex items-center gap-2 rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark">
          Browse Shop
        </Link>
      </div>
    </div>
    </>
  );
}

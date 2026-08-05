import { useState } from "react";
import { Heart } from "lucide-react";

export default function WishlistButton({ size = "h-4 w-4", className = "" }) {
  const [saved, setSaved] = useState(false);
  const toggle = (e) => {
    e.preventDefault();
    setSaved((s) => !s);
  };

  return (
    <button onClick={toggle} aria-pressed={saved} aria-label={saved ? "Remove from wishlist" : "Add to wishlist"} className={`inline-flex items-center justify-center ${className}`}>
      <Heart className={`${size} ${saved ? "fill-red-600 text-red-600" : "text-gray-500"}`} />
    </button>
  );
}

import { useEffect, useState } from "react";

function pad(n) {
  return String(n).padStart(2, "0");
}

/**
 * Ticks down from `durationSeconds` and loops back to the start when it
 * hits zero — this is a cosmetic urgency timer for the Flash Deals strip,
 * not tied to a real deal-expiry timestamp yet (that lands with the real
 * Discount model in Phase 5/6).
 */
export default function CountdownTimer({ durationSeconds = 2 * 3600 + 34 * 60 + 18 }) {
  const [secondsLeft, setSecondsLeft] = useState(durationSeconds);

  useEffect(() => {
    const id = setInterval(() => {
      setSecondsLeft((s) => (s <= 0 ? durationSeconds : s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [durationSeconds]);

  const hours = Math.floor(secondsLeft / 3600);
  const minutes = Math.floor((secondsLeft % 3600) / 60);
  const seconds = secondsLeft % 60;

  return (
    <div className="flex items-center gap-1 text-xs font-bold text-white">
      <span className="rounded bg-ink px-1.5 py-1">{pad(hours)}</span>
      <span className="text-heading">:</span>
      <span className="rounded bg-ink px-1.5 py-1">{pad(minutes)}</span>
      <span className="text-heading">:</span>
      <span className="rounded bg-ink px-1.5 py-1">{pad(seconds)}</span>
    </div>
  );
}

import { Check } from "lucide-react";

const STEPS = ["Cart", "Shipping", "Payment", "Confirmation"];

export default function CheckoutSteps({ current }) {
  return (
    <div className="flex items-center">
      {STEPS.map((label, i) => {
        const step = i + 1;
        const done = step < current;
        const active = step === current;
        return (
          <div key={label} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                  done ? "bg-brand text-white" : active ? "border-2 border-brand text-brand" : "border-2 border-gray-300 text-gray-400"
                }`}
              >
                {done ? <Check className="h-4 w-4" /> : step}
              </span>
              <span className={`mt-1 text-xs font-medium ${active ? "text-brand" : "text-gray-500"}`}>{label}</span>
            </div>
            {step < STEPS.length && <div className={`mx-2 h-0.5 flex-1 ${done ? "bg-brand" : "bg-gray-200"}`} />}
          </div>
        );
      })}
    </div>
  );
}

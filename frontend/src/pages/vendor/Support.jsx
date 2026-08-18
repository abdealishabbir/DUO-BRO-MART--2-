import { MessageCircle, Ticket, Users, HelpCircle } from "lucide-react";
import Card from "../../components/Card.jsx";

const CARDS = [
  { icon: MessageCircle, title: "Live Chat", desc: "Chat with our vendor support team", cta: "Start Chat", color: "text-green-600 bg-green-50" },
  { icon: Ticket, title: "Submit a Ticket", desc: "Report an issue or request help", cta: "Open Ticket", color: "text-blue-600 bg-blue-50" },
  { icon: Users, title: "Vendor Community", desc: "Connect with other Duo Bro Mart vendors", cta: "Join Forum", color: "text-purple-600 bg-purple-50" },
  { icon: HelpCircle, title: "Help Centre", desc: "Browse guides, FAQs and tutorials", cta: "Browse Docs", color: "text-amber-600 bg-amber-50" },
];

export default function VendorSupport() {
  return (
    <div>
      <h2 className="text-xl font-bold text-heading">Help & Support</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {CARDS.map((card) => (
          <Card key={card.title}>
            <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${card.color}`}>
              <card.icon className="h-4 w-4" />
            </span>
            <p className="mt-3 font-semibold text-heading">{card.title}</p>
            <p className="text-sm text-gray-500">{card.desc}</p>
            <button disabled className="mt-2 text-sm font-medium text-gray-300" title="Support channels aren&apos;t live yet">
              {card.cta} →
            </button>
          </Card>
        ))}
      </div>
      <p className="mt-4 text-xs text-gray-400">These channels aren&apos;t connected to a real support system yet — for now, reach out through the contact details on your vendor approval email.</p>
    </div>
  );
}

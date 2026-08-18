import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, Upload, CheckCircle2, Megaphone, Wallet, ShieldCheck, TrendingUp } from "lucide-react";
import FormField, { inputClass } from "../../components/FormField.jsx";
import { api } from "../../lib/api.js";
import Meta from "../../components/Meta.jsx";
import { cardClasses } from "../../components/Card.jsx";

const BUSINESS_TYPES = ["Retailer", "Wholesaler", "Manufacturer", "Home Business", "Importer", "Other"];

const EMPTY_FORM = {
  business_name: "",
  owner_name: "",
  email: "",
  phone_number: "",
  business_type: "",
  description: "",
  social_links: "",
  cnic_number: "",
  bank_name: "",
  account_title: "",
  account_number: "",
  account_cnic: "",
};

const FAQS = [
  {
    q: "How do I register?",
    a: "Fill out the application form below with your business details and CNIC images. Our team verifies the details and gets back to you.",
  },
  {
    q: "What does it cost to sell on Duo Bro Mart?",
    a: "There's no upfront listing fee — Duo Bro Mart takes a small commission on each sale, added on top of your product's base price. You always set your own price; the commission doesn't come out of it.",
  },
  {
    q: "How long does approval take?",
    a: "Most applications are reviewed and approved within 4-5 business days. Part of that review is confirming your bank account is registered under the same CNIC you applied with — see the next question for details. You'll receive your vendor panel login credentials by email once approved.",
  },
  {
    q: "Why does my bank account need to match my CNIC?",
    a: "The bank account you provide must be registered under the exact same CNIC you used for your application — this is how we verify payouts actually go to the person who applied, not someone else. For example, if your application CNIC ends in 0001 but the bank account you give us is registered to a CNIC ending in 9991, the two don't match and your application will be rejected. Double-check this before submitting, since it's one of the main things that extends review to the full 4-5 business days.",
  },
  {
    q: "How do I get paid?",
    a: "Payouts for completed orders are transferred to the bank/account details you provide in your vendor settings after account approval, on a regular payout cycle.",
  },
  {
    q: "Can I run discounts?",
    a: "Yes — you can propose a discount, flash deal, or price change from your vendor panel any time. Every change is reviewed and approved by our admin team before it goes live.",
  },
  {
    q: "How do banner promotions work?",
    a: "Approved vendors can apply for homepage/category banner placements from the vendor panel. Banner slots are reviewed and billed separately from your regular commission.",
  },
  {
    q: "What products are prohibited?",
    a: "Counterfeit goods, weapons, illegal substances, and anything violating Pakistani law or our Vendor Terms & Conditions can't be listed. See our Vendor Terms for the full list.",
  },
];

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-gray-200 py-3">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between text-left text-sm font-semibold text-gray-900">
        {q}
        <ChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <p className="mt-2 text-sm leading-relaxed text-gray-600">{a}</p>}
    </div>
  );
}

function FileUploadField({ label, file, onChange }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
      <div className="flex items-center gap-3 rounded-md border border-dashed border-gray-300 px-3 py-2.5 text-sm text-gray-500 hover:border-brand">
        <Upload className="h-4 w-4 shrink-0" />
        <span className="truncate">{file ? file.name : "Upload JPG image"}</span>
        <input type="file" accept="image/jpeg" className="hidden" onChange={(e) => onChange(e.target.files?.[0] ?? null)} />
      </div>
    </label>
  );
}

export default function BecomeVendor() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [cnicFront, setCnicFront] = useState(null);
  const [cnicBack, setCnicBack] = useState(null);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (
      !form.business_name || !form.owner_name || !form.email || !form.phone_number ||
      !form.business_type || !form.description || !form.cnic_number ||
      !form.bank_name || !form.account_title || !form.account_number || !form.account_cnic
    ) {
      setError("Please fill in all required fields.");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(form.email)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!cnicFront || !cnicBack) {
      setError("Please upload both CNIC / ID card images (front & back).");
      return;
    }
    // §5.7 rule: the bank account must be registered under the exact
    // same CNIC as the application, or it gets rejected during review.
    // We can't verify the account itself is real from the browser, but
    // we *can* catch an obvious mismatch between the two CNIC numbers
    // typed here immediately, instead of making the vendor wait 4-5
    // business days to find out.
    if (form.account_cnic.replace(/[^0-9]/g, "") !== form.cnic_number.replace(/[^0-9]/g, "")) {
      setError("Your bank account's CNIC doesn't match the CNIC number you entered above — this will get your application rejected. Please double-check both fields.");
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      Object.entries(form).forEach(([key, value]) => formData.append(key, value));
      formData.append("cnic_front", cnicFront);
      formData.append("cnic_back", cnicBack);
      await api.postForm("/vendor-applications/", formData);
      setSubmitted(true);
    } catch (err) {
      setError(err.data?.detail || Object.values(err.data || {}).flat().join(" ") || "Something went wrong submitting your application. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const cnicMismatch = form.cnic_number && form.account_cnic &&
    form.account_cnic.replace(/[^0-9]/g, "") !== form.cnic_number.replace(/[^0-9]/g, "");

  if (submitted) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-green-600" />
        <h1 className="font-display mt-4 text-2xl font-bold text-gray-900">Application received</h1>
        <p className="mt-2 text-sm text-gray-600">
          You&apos;ll be verified — including confirming your bank account matches your CNIC — and receive vendor panel login access within <strong>4-5 business days</strong>. We&apos;ll email {form.email} once your account is approved.
        </p>
        <Link to="/" className="mt-6 inline-block rounded-md bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark">
          Back to Home
        </Link>
      </div>
    );
  }

  return (
    <div>
      <Meta title="Sell on Duo Bro Mart — Become a Vendor" description="Start selling on Duo Bro Mart, Pakistan's multi-vendor marketplace — reach customers nationwide with COD delivery and built-in promotion tools." url={`${window.location.origin}/become-a-vendor`} />
      <section className="bg-cream px-4 py-14 text-center">
        <h1 className="font-display text-3xl font-bold text-gray-900 sm:text-4xl">Sell on Duo Bro Mart</h1>
        <p className="mx-auto mt-3 max-w-xl text-gray-600">
          Reach customers across Pakistan — including rural areas most marketplaces skip — with our COD delivery network and built-in banner promotion tools.
        </p>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-12">
        <h2 className="text-xl font-bold text-gray-900">Why sell on Duo Bro Mart</h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2 md:grid-cols-4">
          {[
            { icon: TrendingUp, title: "Nationwide Reach", desc: "Get discovered by customers in every province, from Karachi to rural landmarks." },
            { icon: Wallet, title: "Fair Commission", desc: "Set your own base price — our commission is added on top, never deducted from it." },
            { icon: Megaphone, title: "Banner Promotion", desc: "Boost visibility with homepage and category banner placements once approved." },
            { icon: ShieldCheck, title: "COD Network", desc: "Built-in Cash on Delivery support, the payment method Pakistani shoppers trust most." },
          ].map((item) => (
            <div key={item.title} className="rounded-lg border border-gray-200 p-5">
              <item.icon className="h-6 w-6 text-brand" />
              <p className="mt-3 font-semibold text-gray-900">{item.title}</p>
              <p className="mt-1 text-sm text-gray-500">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-gray-50 px-4 py-12">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-xl font-bold text-gray-900">How it works</h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            {[
              "Fill application",
              "Verification & review",
              "Approval in 4-5 business days",
              "Receive vendor login credentials",
              "Start selling",
            ].map((step, i) => (
              <div key={step} className="rounded-lg bg-surface p-4 text-center shadow-sm">
                <span className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">{i + 1}</span>
                <p className="mt-2 text-sm font-medium text-gray-800">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-2xl px-4 py-12">
        <h2 className="text-xl font-bold text-gray-900">Vendor Application</h2>
        <form onSubmit={handleSubmit} className={cardClasses({ padding: "none", className: "mt-5 space-y-4 p-5" })}>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Business Name">
              <input className={inputClass} value={form.business_name} onChange={(e) => setForm({ ...form, business_name: e.target.value })} />
            </FormField>
            <FormField label="Owner Name">
              <input className={inputClass} value={form.owner_name} onChange={(e) => setForm({ ...form, owner_name: e.target.value })} />
            </FormField>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Email Address">
              <input type="email" className={inputClass} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </FormField>
            <FormField label="Contact Number">
              <input className={inputClass} placeholder="03001234567" value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} />
            </FormField>
          </div>
          <FormField label="Business Type">
            <select className={inputClass} value={form.business_type} onChange={(e) => setForm({ ...form, business_type: e.target.value })}>
              <option value="" disabled>Select business type</option>
              {BUSINESS_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </FormField>
          <FormField label="CNIC Number">
            <input className={inputClass} placeholder="42101-1234567-1" value={form.cnic_number} onChange={(e) => setForm({ ...form, cnic_number: e.target.value })} />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FileUploadField label="CNIC / ID Card (Front)" file={cnicFront} onChange={setCnicFront} />
            <FileUploadField label="CNIC / ID Card (Back)" file={cnicBack} onChange={setCnicBack} />
          </div>

          <div className="rounded-md border border-gray-200 p-4">
            <p className="text-sm font-semibold text-gray-900">Bank Account Details</p>
            <p className="mt-1 text-xs text-gray-500">
              This account must be registered under the <strong>same CNIC</strong> you entered above — a mismatch is one of the main reasons applications get rejected. See the FAQ below for why.
            </p>
            <div className="mt-4 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Bank Name">
                  <input className={inputClass} placeholder="e.g. HBL, Meezan, UBL" value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} />
                </FormField>
                <FormField label="Account Title">
                  <input className={inputClass} placeholder="Name on the account" value={form.account_title} onChange={(e) => setForm({ ...form, account_title: e.target.value })} />
                </FormField>
              </div>
              <FormField label="Account Number / IBAN">
                <input className={inputClass} value={form.account_number} onChange={(e) => setForm({ ...form, account_number: e.target.value })} />
              </FormField>
              <FormField label="CNIC This Account Is Registered Under">
                <input className={inputClass} placeholder="42101-1234567-1" value={form.account_cnic} onChange={(e) => setForm({ ...form, account_cnic: e.target.value })} />
              </FormField>
              {cnicMismatch && (
                <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
                  This doesn&apos;t match the CNIC number you entered above. Your application will be rejected if this isn&apos;t fixed before submitting.
                </p>
              )}
            </div>
          </div>
          <FormField label="Business Description (what do you sell?)">
            <textarea className={`${inputClass} min-h-[90px] resize-y`} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </FormField>
          <FormField label="Social Media Page Links (optional)">
            <input className={inputClass} placeholder="Facebook, Instagram, TikTok, or website URL" value={form.social_links} onChange={(e) => setForm({ ...form, social_links: e.target.value })} />
          </FormField>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button type="submit" disabled={submitting} className="w-full rounded-md bg-brand py-3 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60">
            {submitting ? "Submitting..." : "Submit Application"}
          </button>
        </form>
      </section>

      <section className="mx-auto max-w-2xl px-4 py-12">
        <h2 className="text-xl font-bold text-gray-900">Frequently Asked Questions</h2>
        <div className="mt-4">
          {FAQS.map((item) => <FaqItem key={item.q} {...item} />)}
        </div>
      </section>

      <section className="mx-auto max-w-2xl px-4 pb-16 text-center text-sm text-gray-600">
        Already a vendor?{" "}
        <Link to="/vendor/login" className="font-medium text-brand hover:underline">
          Log in to your vendor account
        </Link>
      </section>
    </div>
  );
}

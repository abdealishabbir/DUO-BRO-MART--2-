import { Link } from "react-router-dom";

function Section({ number, title, children }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold text-gray-900">{number}. {title}</h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-gray-600">{children}</div>
    </section>
  );
}

// Placeholder terms — generic e-commerce boilerplate common across
// Pakistani and international marketplaces (Daraz, Amazon-style),
// standing in until real legal-reviewed text is provided.
export default function Terms() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <span className="rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand">
        Placeholder — pending final legal review
      </span>
      <h1 className="mt-4 text-3xl font-bold text-gray-900">Terms &amp; Conditions</h1>
      <p className="mt-2 text-sm text-gray-500">Last updated: July 2026 · Duo Bro Mart, Pakistan</p>

      <Section number={1} title="Acceptance of Terms">
        <p>
          By creating an account, browsing, or placing an order on Duo Bro Mart, you agree to be bound
          by these Terms &amp; Conditions and our Privacy Policy. If you do not agree, please do not use
          the platform.
        </p>
      </Section>

      <Section number={2} title="Account Registration">
        <p>
          You must provide accurate, current information (including a valid Pakistani mobile number)
          when creating an account, and you are responsible for keeping your login credentials
          confidential. You must be at least 18 years old, or have a parent/guardian's consent, to
          register.
        </p>
      </Section>

      <Section number={3} title="Orders, Pricing & Currency">
        <p>
          All prices are listed in Pakistani Rupees (PKR) and are inclusive of applicable taxes unless
          stated otherwise. We reserve the right to correct pricing errors and to cancel or refuse any
          order at our discretion, including in cases of suspected fraud or unavailability of stock.
        </p>
      </Section>

      <Section number={4} title="Payment Methods">
        <p>
          We accept Cash on Delivery (COD), major debit/credit cards, and select digital wallets, as
          shown at checkout. For COD orders, payment is due in full to the delivery rider upon receipt
          of your order.
        </p>
      </Section>

      <Section number={5} title="Shipping & Delivery">
        <p>
          Estimated delivery times are provided for guidance only and are not guaranteed. Delivery to
          rural or remote areas may take longer and may rely on the landmark/reference details you
          provide at checkout. Risk of loss passes to you upon delivery.
        </p>
      </Section>

      <Section number={6} title="Returns, Refunds & Cancellations">
        <p>
          Eligible items may be returned within 7 days of delivery in original, unused condition with
          packaging intact, unless the product listing states otherwise. Refunds are processed to the
          original payment method or as store credit, at the customer's choice, within a reasonable
          processing period. Perishable items, personal care products, and custom orders may not be
          eligible for return.
        </p>
      </Section>

      <Section number={7} title="Marketplace & Vendor Relationship">
        <p>
          Duo Bro Mart is a marketplace connecting customers with independent, third-party vendors.
          Product descriptions, pricing, quality, and fulfillment are the responsibility of the
          selling vendor; Duo Bro Mart facilitates the transaction and payment but is not the
          manufacturer or seller of record unless explicitly stated.
        </p>
      </Section>

      <Section number={8} title="Prohibited Conduct">
        <p>
          You agree not to misuse the platform, including but not limited to: submitting false
          information, attempting to defraud vendors or other customers, interfering with platform
          security, or using the platform for any unlawful purpose under the laws of Pakistan.
        </p>
      </Section>

      <Section number={9} title="Intellectual Property">
        <p>
          The Duo Bro Mart name, logo, and platform design are the property of Duo Bro Mart. Product
          images and descriptions are owned by the respective vendors or their licensors.
        </p>
      </Section>

      <Section number={10} title="Limitation of Liability">
        <p>
          To the maximum extent permitted by law, Duo Bro Mart is not liable for indirect, incidental,
          or consequential damages arising from your use of the platform, including delays, product
          defects caused by third-party vendors, or service interruptions.
        </p>
      </Section>

      <Section number={11} title="Governing Law">
        <p>
          These Terms are governed by the laws of the Islamic Republic of Pakistan. Any disputes shall
          be subject to the exclusive jurisdiction of the courts of Karachi, Sindh.
        </p>
      </Section>

      <Section number={12} title="Changes to These Terms">
        <p>
          We may update these Terms from time to time. Continued use of the platform after changes
          are posted constitutes acceptance of the revised Terms.
        </p>
      </Section>

      <Section number={13} title="Contact Us">
        <p>
          Questions about these Terms can be sent to <span className="font-medium">support@duobromart.com</span>.
        </p>
      </Section>

      <p className="mt-10 text-sm text-gray-500">
        Selling on Duo Bro Mart?{" "}
        <Link to="/vendor-terms" className="font-medium text-brand hover:underline">
          Read the Vendor Terms &amp; Conditions
        </Link>
        .
      </p>
    </div>
  );
}

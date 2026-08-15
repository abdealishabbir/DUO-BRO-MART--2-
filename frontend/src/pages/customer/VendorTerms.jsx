import { Link } from "react-router-dom";
import Meta from "../../components/Meta.jsx";
import Badge from "../../components/Badge.jsx";

function Section({ number, title, children }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold text-gray-900">{number}. {title}</h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-gray-600">{children}</div>
    </section>
  );
}

// Placeholder vendor terms — generic marketplace-seller boilerplate,
// standing in until real legal-reviewed text is provided.
export default function VendorTerms() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <Meta title="Vendor Terms & Conditions — Duo Bro Mart" description="Terms and conditions for vendors selling on Duo Bro Mart, Pakistan's multi-vendor marketplace." url={`${window.location.origin}/vendor-terms`} />
      <Badge variant="warning" className="normal-case tracking-wide">
        Placeholder — pending final legal review
      </Badge>
      <h1 className="font-display mt-4 text-3xl font-bold text-gray-900">Vendor Terms &amp; Conditions</h1>
      <p className="mt-2 text-sm text-gray-500">Last updated: July 2026 · Duo Bro Mart, Pakistan</p>

      <Section number={1} title="Eligibility & Onboarding">
        <p>
          To sell on Duo Bro Mart, you must submit a vendor application with accurate business and
          contact information. Approval is at Duo Bro Mart&apos;s sole discretion. Approved vendors are
          issued account credentials and must change their temporary password on first login.
        </p>
      </Section>

      <Section number={2} title="Product Listings">
        <p>
          You are solely responsible for the accuracy of your product titles, descriptions, images,
          pricing, and stock levels. Listings are subject to admin review and may be rejected or
          removed if they violate platform policy, infringe intellectual property, or misrepresent
          the product.
        </p>
      </Section>

      <Section number={3} title="Prohibited Items">
        <p>
          You may not list counterfeit goods, illegal substances, weapons, hazardous materials, or any
          item prohibited under the laws of Pakistan. Duo Bro Mart reserves the right to remove
          listings and suspend accounts found in violation without prior notice.
        </p>
      </Section>

      <Section number={4} title="Pricing, Commission & Payouts">
        <p>
          All prices you list must be in Pakistani Rupees (PKR) and inclusive of your applicable
          commission to Duo Bro Mart, as agreed at onboarding. Payouts for completed, non-returned
          orders are processed on the schedule communicated in your vendor dashboard.
        </p>
      </Section>

      <Section number={5} title="Orders & Fulfillment">
        <p>
          You must fulfill accepted orders within the timeframe shown in your vendor panel and keep
          stock levels accurate to avoid overselling. Repeated failure to fulfill orders may result in
          listing suspension or account review.
        </p>
      </Section>

      <Section number={6} title="Banners & Promotions">
        <p>
          Hero banner slots are limited and allocated on a first-approved basis at the rate shown in
          your Promotion &amp; Banner section at the time of application. For postpaid banners,
          payment is due by the end of your selected promotion period; unpaid balances accrue a daily
          penalty and may result in account suspension after a set grace period, as detailed in your
          vendor dashboard. Prepaid banners must be paid before the banner is published, and unpaid
          prepaid requests expire automatically after a short grace period.
        </p>
      </Section>

      <Section number={7} title="Returns, Refunds & Disputes">
        <p>
          You agree to honor Duo Bro Mart&apos;s platform-wide returns policy for eligible items sold
          through your store, and to cooperate in good faith with customer disputes escalated by Duo
          Bro Mart&apos;s support team.
        </p>
      </Section>

      <Section number={8} title="Account Suspension & Termination">
        <p>
          Duo Bro Mart may suspend or terminate your vendor account for policy violations, repeated
          customer complaints, non-payment of amounts owed (including banner penalties), or fraudulent
          activity. Duo Bro Mart also reserves the right to pursue legal action for outstanding debts
          where applicable.
        </p>
      </Section>

      <Section number={9} title="Intellectual Property">
        <p>
          You retain ownership of your product content but grant Duo Bro Mart a license to display,
          reproduce, and promote it across the platform (including banners, marketing, and search
          results) for the duration your listings or promotions are active.
        </p>
      </Section>

      <Section number={10} title="Limitation of Liability">
        <p>
          To the maximum extent permitted by law, Duo Bro Mart is not liable for indirect or
          consequential losses arising from platform downtime, payment processing delays, or customer
          disputes beyond Duo Bro Mart&apos;s reasonable control.
        </p>
      </Section>

      <Section number={11} title="Governing Law">
        <p>
          These Vendor Terms are governed by the laws of the Islamic Republic of Pakistan, with
          exclusive jurisdiction in the courts of Karachi, Sindh.
        </p>
      </Section>

      <Section number={12} title="Changes to These Terms">
        <p>
          These Terms may be updated periodically. Continued use of your vendor account after changes
          are posted constitutes acceptance of the revised Terms.
        </p>
      </Section>

      <Section number={13} title="Contact Us">
        <p>
          Vendor support questions can be sent to <span className="font-medium">vendors@duobromart.com</span>.
        </p>
      </Section>

      <p className="mt-10 text-sm text-gray-500">
        Shopping instead?{" "}
        <Link to="/terms" className="font-medium text-brand hover:underline">
          Read the Customer Terms &amp; Conditions
        </Link>
        .
      </p>
    </div>
  );
}

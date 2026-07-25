import { useEffect, useMemo, useState } from "react";
import { ImagePlus, RefreshCw } from "lucide-react";
import { api } from "../../lib/api.js";
import { formatPKR } from "../../lib/currency.js";
import FormField, { inputClass } from "../../components/FormField.jsx";

// Hero banner is rendered full-width at a fixed aspect ratio on Home
// (see Hero() in customer/Home.jsx) — an image that isn't exactly this
// size gets stretched/blurred (too small) or cropped at the sides (wrong
// aspect ratio) by the bg-cover treatment. Enforcing an exact match here
// means every vendor's banner looks crisp and uncropped once approved.
const REQUIRED_WIDTH = 1600;
const REQUIRED_HEIGHT = 500;
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/jpg"];

function validateBannerImage(file) {
  return new Promise((resolve) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      resolve({ valid: false, error: "Only PNG, JPG, or JPEG images are allowed." });
      return;
    }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      if (img.naturalWidth !== REQUIRED_WIDTH || img.naturalHeight !== REQUIRED_HEIGHT) {
        resolve({
          valid: false,
          error: `Image is ${img.naturalWidth}×${img.naturalHeight}px — it must be exactly ${REQUIRED_WIDTH}×${REQUIRED_HEIGHT}px, or it'll blur or get cropped on the homepage.`,
        });
        return;
      }
      resolve({ valid: true });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ valid: false, error: "Couldn't read that image file. Please try a different one." });
    };
    img.src = url;
  });
}

const STATUS_STYLES = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-blue-100 text-blue-700",
  rejected: "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-600",
  awaiting_payment: "bg-amber-100 text-amber-700",
  scheduled: "bg-blue-100 text-blue-700",
  live: "bg-green-100 text-green-700",
  completed: "bg-gray-100 text-gray-600",
  overdue: "bg-red-100 text-red-700",
  suspended: "bg-red-200 text-red-900",
};

function StatusBadge({ status }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLES[status] || "bg-gray-100 text-gray-600"}`}>
      {status.replace("_", " ")}
    </span>
  );
}

function ApplicationForm({ platformSettings, availability, onSubmitted }) {
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageError, setImageError] = useState("");
  const [headline, setHeadline] = useState("");
  const [description, setDescription] = useState("");
  const [ctaLabel, setCtaLabel] = useState("Shop Now");
  const [ctaUrl, setCtaUrl] = useState("");
  const [days, setDays] = useState(7);
  const [paymentType, setPaymentType] = useState("prepaid");
  const [startDate, setStartDate] = useState(availability?.next_available_date || "");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const pricePerDay = platformSettings?.banner_price_per_day ?? 0;
  const totalPrice = useMemo(() => Number(pricePerDay) * Number(days || 0), [pricePerDay, days]);

  const handleImageChange = async (e) => {
    const file = e.target.files?.[0];
    setImageError("");
    if (!file) {
      setImage(null);
      setImagePreview(null);
      return;
    }
    const result = await validateBannerImage(file);
    if (!result.valid) {
      setImage(null);
      setImagePreview(null);
      setImageError(result.error);
      e.target.value = ""; // let them retry with the same filename if needed
      return;
    }
    setImage(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!image) {
      setError(imageError || "Please attach a banner image.");
      return;
    }

    const formData = new FormData();
    formData.append("image", image);
    formData.append("headline", headline);
    formData.append("description", description);
    formData.append("cta_label", ctaLabel);
    formData.append("cta_url", ctaUrl);
    formData.append("requested_days", days);
    formData.append("payment_type", paymentType);
    if (availability?.slots_available === 0 && startDate) {
      formData.append("requested_start_date", startDate);
    }

    setSubmitting(true);
    try {
      await api.postForm("/banners/vendor/applications/", formData);
      setSuccess(true);
      onSubmitted();
    } catch (err) {
      setError(err.data?.detail || Object.values(err.data || {}).flat().join(" ") || "Could not submit request.");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-6 text-center">
        <p className="font-medium text-green-800">Request submitted — waiting for admin approval.</p>
        <button onClick={() => setSuccess(false)} className="mt-3 text-sm text-brand hover:underline">
          Submit another
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-gray-200 bg-white p-5">
      <div className="rounded-md bg-cream px-3 py-2 text-sm text-gray-700">
        Current rate: <strong>{formatPKR(pricePerDay)}/day</strong> · Hero slots:{" "}
        <strong>{availability?.slots_occupied ?? "—"}/{availability?.carousel_slot_limit ?? "—"}</strong> in use
        {availability?.slots_available === 0 && (
          <span className="ml-1 text-amber-700">— all full, next opening ~{availability.next_available_date}</span>
        )}
      </div>

      <FormField label="Banner image">
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-gray-300 px-4 py-6 text-sm text-gray-500 hover:border-brand">
          {imagePreview ? (
            <img src={imagePreview} alt="preview" className="h-24 w-full rounded-md object-cover" />
          ) : (
            <>
              <ImagePlus className="h-6 w-6" />
              Click to attach an image
            </>
          )}
          <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleImageChange} />
        </label>
        <p className="mt-1.5 text-xs text-gray-400">
          Must be exactly <strong>{REQUIRED_WIDTH}×{REQUIRED_HEIGHT}px</strong>, PNG/JPG/JPEG — any other size gets rejected so it doesn't blur or crop on the homepage.
        </p>
        {imageError && <p className="mt-1 text-sm text-red-600">{imageError}</p>}
      </FormField>

      <FormField label="Headline">
        <input className={inputClass} value={headline} onChange={(e) => setHeadline(e.target.value)} required maxLength={150} />
      </FormField>

      <FormField label="Description">
        <textarea className={inputClass} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      </FormField>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="CTA button text">
          <input className={inputClass} value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} maxLength={40} />
        </FormField>
        <FormField label="CTA link (where it takes shoppers)">
          <input className={inputClass} value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} placeholder="/shop" required />
        </FormField>
      </div>

      {availability?.slots_available === 0 && (
        <FormField label="Requested start date (a slot opens around this time)">
          <input type="date" className={inputClass} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </FormField>
      )}

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Number of days">
          <input
            type="number"
            min={1}
            max={90}
            className={inputClass}
            value={days}
            onChange={(e) => setDays(e.target.value)}
            required
          />
        </FormField>
        <FormField label="Total price">
          <div className={`${inputClass} bg-cream font-semibold text-brand`}>{formatPKR(totalPrice)}</div>
        </FormField>
      </div>

      <FormField label="Payment option">
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="radio" name="paymentType" checked={paymentType === "prepaid"} onChange={() => setPaymentType("prepaid")} />
            Prepaid — pay first, goes live the next day
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="paymentType" checked={paymentType === "postpaid"} onChange={() => setPaymentType("postpaid")} />
            Postpaid — goes live after approval, pay by the due date
          </label>
        </div>
      </FormField>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
      >
        {submitting ? "Submitting..." : "Submit request"}
      </button>
    </form>
  );
}

function ApplicationsList({ applications }) {
  if (applications.length === 0) return <p className="text-sm text-gray-500">No requests yet.</p>;
  return (
    <div className="space-y-2">
      {applications.map((app) => (
        <div key={app.id} className="flex items-center justify-between rounded-md border border-gray-200 bg-white p-3 text-sm">
          <div className="flex items-center gap-3">
            <img src={app.image} alt="" className="h-10 w-16 rounded object-cover" />
            <div>
              <p className="font-medium text-gray-900">{app.headline}</p>
              <p className="text-xs text-gray-500">{app.requested_days} days · {app.payment_type} · Rs. {app.total_price}</p>
            </div>
          </div>
          <StatusBadge status={app.status} />
        </div>
      ))}
    </div>
  );
}

function BannerPaymentCard({ banner }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <img src={banner.image} alt="" className="h-16 w-28 rounded-md object-cover" />
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-gray-900">{banner.headline}</p>
            <StatusBadge status={banner.status} />
          </div>
          <p className="text-xs text-gray-500">
            Slot {banner.slot_position} · {banner.days} days · {banner.payment_type}
            {banner.live_start_date && ` · ${banner.live_start_date} → ${banner.live_end_date}`}
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2 rounded-md bg-cream p-3 text-center text-xs">
        <div>
          <p className="text-gray-500">Banner price</p>
          <p className="font-semibold text-gray-900">{formatPKR(banner.total_price)}</p>
        </div>
        <div>
          <p className="text-gray-500">Paid</p>
          <p className="font-semibold text-green-700">{formatPKR(banner.paid_amount)}</p>
        </div>
        <div>
          <p className="text-gray-500">Penalty</p>
          <p className={`font-semibold ${Number(banner.penalty_amount) > 0 ? "text-red-600" : "text-gray-400"}`}>
            {formatPKR(banner.penalty_amount)}
          </p>
        </div>
        <div>
          <p className="text-gray-500">Remaining</p>
          <p className="font-semibold text-brand">{formatPKR(banner.remaining_amount)}</p>
        </div>
      </div>
      {banner.status === "overdue" && (
        <p className="mt-2 text-xs text-red-600">
          Overdue {banner.days_overdue} day(s) — Rs. 100/day penalty is accruing. Account is suspended automatically after 3 unpaid days.
        </p>
      )}
    </div>
  );
}

export default function PromotionBanner() {
  const [platformSettings, setPlatformSettings] = useState(null);
  const [availability, setAvailability] = useState(null);
  const [applications, setApplications] = useState([]);
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadAll = async () => {
    const [settingsData, availabilityData, applicationsData, bannersData] = await Promise.all([
      api.get("/banners/vendor/settings/"),
      api.get("/banners/vendor/availability/"),
      api.get("/banners/vendor/applications/"),
      api.get("/banners/vendor/my-banners/"),
    ]);
    setPlatformSettings(settingsData);
    setAvailability(availabilityData);
    setApplications(applicationsData.results ?? applicationsData);
    setBanners(bannersData);
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
    // "Real-time" here means periodic refresh rather than a live socket
    // push — WebSocket push for this is reserved for Phase 7 (Channels).
    const interval = setInterval(loadAll, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div className="p-6 text-sm text-gray-500">Loading...</div>;

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Promotion &amp; Banner</h1>
        <button onClick={loadAll} className="flex items-center gap-1 text-sm text-gray-500 hover:text-brand">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {banners.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-gray-700">Your banners &amp; payment status</h2>
          <div className="space-y-3">
            {banners.map((b) => <BannerPaymentCard key={b.id} banner={b} />)}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Apply for a hero banner slot</h2>
        <ApplicationForm platformSettings={platformSettings} availability={availability} onSubmitted={loadAll} />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Your requests</h2>
        <ApplicationsList applications={applications} />
      </section>
    </div>
  );
}

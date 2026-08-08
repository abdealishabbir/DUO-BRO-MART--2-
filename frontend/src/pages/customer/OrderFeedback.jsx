import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Package, Clock, RotateCcw, ThumbsUp, ThumbsDown, Star, Camera, CheckCircle2, XCircle, X, ShieldCheck } from "lucide-react";
import { api } from "../../lib/api.js";
import { formatPKR } from "../../lib/currency.js";
import { inputClass } from "../../components/FormField.jsx";
import { useAuth } from "../../auth/AuthContext.jsx";

const RETURN_WINDOW_DAYS = 7;

// Mirrors apps/feedback/models.py — client-side checks are a fast first
// pass so the customer doesn't wait for a round-trip to find out a photo
// was rejected; the backend re-validates the same rules regardless.
const MAX_FEEDBACK_IMAGES = 5;
const MAX_IMAGE_SIZE_MB = 5;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png"];

function PhotoDropzone({ files, onAdd, onRemove, error }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = (fileList) => {
    onAdd(Array.from(fileList || []));
  };

  return (
    <div>
      <button
        type="button"
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`mt-2 flex w-full cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed p-6 text-center text-xs transition-colors ${
          dragging ? "border-brand bg-brand/5 text-brand" : "border-gray-300 text-gray-400 hover:border-brand hover:text-brand"
        }`}
      >
        <Camera className="mb-1 h-5 w-5" />
        {files.length >= MAX_FEEDBACK_IMAGES
          ? `Maximum ${MAX_FEEDBACK_IMAGES} photos reached`
          : "Click or drag photos here (JPG/PNG, up to 5MB each)"}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png"
          multiple
          className="hidden"
          onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }}
        />
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      {files.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {files.map((f, i) => (
            <div key={i} className="group relative h-16 w-16 overflow-hidden rounded-md border border-gray-200">
              <img src={f.preview} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onRemove(i); }}
                aria-label={`Remove photo ${i + 1}`}
                className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white opacity-0 transition-opacity focus:opacity-100 focus:outline focus:outline-2 focus:outline-white group-hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const COMPLAINT_REASONS = [
  ["wrong_product", "Wrong item received"],
  ["damaged", "Item arrived damaged"],
  ["missing_item", "Item missing from order"],
  ["not_as_described", "Not as described"],
  ["other", "Other"],
];

const RATING_CATEGORIES = [
  { key: "delivery_rating", label: "Delivery Speed", hint: "How fast did your order arrive?", icon: Package },
  { key: "packaging_rating", label: "Packaging Quality", hint: "Was the packaging secure and neat?", icon: Package },
  { key: "quality_rating", label: "Product Quality", hint: "Does the product match its description?", icon: CheckCircle2 },
  { key: "service_rating", label: "Customer Service", hint: "Support responsiveness and helpfulness", icon: ThumbsUp },
  { key: "overall_rating", label: "Overall Experience", hint: "Your overall Duo Bro Mart experience", icon: Star },
];

function daysRemaining(deliveredAt) {
  if (!deliveredAt) return RETURN_WINDOW_DAYS;
  const deadline = new Date(deliveredAt);
  deadline.setDate(deadline.getDate() + RETURN_WINDOW_DAYS);
  const diff = Math.ceil((deadline - new Date()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
}

function StarRow({ value, onChange }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" onClick={() => onChange(n)} className="p-0.5">
          <Star className={`h-6 w-6 ${n <= value ? "fill-gold text-gold" : "text-gray-300"}`} />
        </button>
      ))}
    </div>
  );
}

function ItemCard({ item, state, contact, onConfirm, onReport }) {
  const [reason, setReason] = useState("wrong_product");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const submitReport = async () => {
    setSubmitting(true);
    setError("");
    try {
      await api.post("/complaints/", { order_item: item.id, reason, description, contact });
      onReport(item.id);
    } catch (err) {
      setError(err.data?.detail || Object.values(err.data || {}).flat().join(" ") || "Could not submit report.");
    } finally {
      setSubmitting(false);
    }
  };

  const style =
    state === "confirmed" ? "border-green-300 bg-green-50" : state === "reported" ? "border-red-300 bg-red-50" : "border-gray-200 bg-white";

  return (
    <div className={`rounded-lg border p-4 ${style}`}>
      <div className="flex items-start gap-3">
        {item.image && <img src={item.image} alt="" className="h-16 w-16 rounded-md object-cover" />}
        <div className="flex-1">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-semibold text-gray-900">{item.product_name}</p>
              <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
              <p className="mt-1 text-sm font-bold text-brand">{formatPKR(item.unit_price)}</p>
            </div>
            {state === "confirmed" && <CheckCircle2 className="h-5 w-5 text-green-600" />}
            {state === "reported" && <XCircle className="h-5 w-5 text-red-600" />}
          </div>
        </div>
      </div>

      {state === "pending" && (
        <>
          <div className="my-3 border-t border-gray-100" />
          <p className="text-sm text-gray-700">Did you receive this product correctly?</p>
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => onConfirm(item.id)}
              className="flex flex-1 items-center justify-center gap-2 rounded-md bg-green-600 py-2 text-sm font-semibold text-white hover:bg-green-700"
            >
              <ThumbsUp className="h-4 w-4" /> Yes, it&apos;s correct
            </button>
            <button
              onClick={() => onReport(`show-form-${item.id}`)}
              className="flex flex-1 items-center justify-center gap-2 rounded-md border border-red-300 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
            >
              <ThumbsDown className="h-4 w-4" /> Wrong item
            </button>
          </div>
        </>
      )}

      {state === "reporting" && (
        <div className="mt-3 border-t border-red-200 pt-3">
          <p className="flex items-center gap-1 text-sm font-medium text-red-700">We&apos;re sorry! Let&apos;s file a return request.</p>
          <select className={`${inputClass} mt-2`} value={reason} onChange={(e) => setReason(e.target.value)}>
            {COMPLAINT_REASONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <textarea
            className={`${inputClass} mt-2 min-h-[70px]`}
            placeholder="Describe the issue (optional)..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
          <button onClick={submitReport} disabled={submitting} className="mt-2 w-full rounded-md bg-red-600 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">
            {submitting ? "Submitting..." : "Submit Return Request"}
          </button>
        </div>
      )}

      {state === "reported" && <p className="mt-2 text-xs text-red-600">A return request has been filed for this item.</p>}
      {state === "confirmed" && <p className="mt-2 text-xs text-green-700">Confirmed — product received correctly.</p>}
    </div>
  );
}

export default function OrderFeedback() {
  const { orderCode } = useParams();
  const { isAuthenticated } = useAuth();
  const [contact, setContact] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState("");
  const [order, setOrder] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [itemStates, setItemStates] = useState({});
  const [step, setStep] = useState(1);
  const [ratings, setRatings] = useState({});
  const [reviewText, setReviewText] = useState("");
  const [wouldRecommend, setWouldRecommend] = useState(null);
  const [photos, setPhotos] = useState([]); // [{ file, preview }]
  const [photoError, setPhotoError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // Revoke object URLs on unmount so we don't leak memory across the session.
    return () => photos.forEach((p) => URL.revokeObjectURL(p.preview));
  }, [photos]);

  const addPhotos = (newFiles) => {
    setPhotoError("");
    const accepted = [];
    for (const file of newFiles) {
      if (photos.length + accepted.length >= MAX_FEEDBACK_IMAGES) {
        setPhotoError(`You can add up to ${MAX_FEEDBACK_IMAGES} photos.`);
        break;
      }
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        setPhotoError("Only JPG or PNG images are allowed.");
        continue;
      }
      if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
        setPhotoError(`Each photo must be under ${MAX_IMAGE_SIZE_MB}MB.`);
        continue;
      }
      accepted.push({ file, preview: URL.createObjectURL(file) });
    }
    if (accepted.length) setPhotos((p) => [...p, ...accepted]);
  };

  const removePhoto = (index) => {
    setPhotos((p) => {
      URL.revokeObjectURL(p[index].preview);
      return p.filter((_, i) => i !== index);
    });
  };

  // Logged-in owners: verified by session, matching this order's customer —
  // no contact needed, look it up automatically on load. Guests: no session
  // to check against, so we wait for them to prove ownership via the form
  // below (same order_code + email/phone-at-checkout check TrackOrder uses)
  // before ever fetching order details.
  const lookupOrder = (contactValue) => {
    const params = new URLSearchParams({ order_code: orderCode });
    if (contactValue) params.set("contact", contactValue);
    return api.get(`/feedback/eligible-orders/?${params.toString()}`).then((orders) => {
      const found = orders[0];
      if (!found) {
        if (contactValue) {
          setVerifyError("We couldn't verify that order — check the order ID and the email/phone used at checkout.");
        } else {
          setNotFound(true);
        }
        return;
      }
      setOrder(found);
      setItemStates(Object.fromEntries(found.items.map((i) => [i.id, "pending"])));
    });
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    setVerifying(true);
    lookupOrder(null).finally(() => setVerifying(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, orderCode]);

  const handleVerify = async (e) => {
    e.preventDefault();
    setVerifyError("");
    setVerifying(true);
    await lookupOrder(contact.trim());
    setVerifying(false);
  };

  const handleConfirm = (itemId) => setItemStates((s) => ({ ...s, [itemId]: "confirmed" }));
  const handleReport = (itemIdOrShowFlag) => {
    if (typeof itemIdOrShowFlag === "string" && itemIdOrShowFlag.startsWith("show-form-")) {
      const id = Number(itemIdOrShowFlag.replace("show-form-", ""));
      setItemStates((s) => ({ ...s, [id]: "reporting" }));
    } else {
      setItemStates((s) => ({ ...s, [itemIdOrShowFlag]: "reported" }));
    }
  };

  const ratedCount = RATING_CATEGORIES.filter((c) => ratings[c.key]).length;

  const submitFeedback = async () => {
    setSubmitting(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("order", order.id);
      formData.append("contact", contact);
      Object.entries(ratings).forEach(([key, value]) => formData.append(key, value));
      formData.append("review_text", reviewText);
      if (wouldRecommend !== null) formData.append("would_recommend", wouldRecommend);
      photos.forEach((p) => formData.append("images", p.file));
      await api.postForm("/feedback/", formData);
      setSubmitted(true);
    } catch (err) {
      setError(err.data?.detail || Object.values(err.data || {}).flat().join(" ") || "Could not submit feedback.");
    } finally {
      setSubmitting(false);
    }
  };

  // Guest gate: not logged in, and we haven't yet confirmed ownership of
  // this specific order. Shown before anything about the order itself —
  // its contents, delivery date, items — is fetched or displayed.
  if (!isAuthenticated && !order && !notFound) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <div className="flex items-center gap-2 text-brand">
          <ShieldCheck className="h-5 w-5" />
          <h1 className="text-xl font-bold text-gray-900">Verify Your Order</h1>
        </div>
        <p className="mt-1 text-sm text-gray-500">
          Confirm the email or phone number used at checkout for order <span className="font-semibold text-gray-700">{orderCode}</span>.
        </p>
        <form onSubmit={handleVerify} className="mt-5 space-y-4 rounded-lg border border-gray-200 bg-white p-5">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-700">Email or Phone Number</span>
            <input
              className={inputClass}
              placeholder="you@example.com or 03001234567"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
            />
          </label>
          {verifyError && <p className="text-sm text-red-600">{verifyError}</p>}
          <button
            type="submit"
            disabled={verifying || !contact.trim()}
            className="w-full rounded-md bg-brand py-3 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
          >
            {verifying ? "Verifying..." : "Continue"}
          </button>
        </form>
        <p className="mt-4 text-center text-xs text-gray-400">
          Have an account? <Link to="/login" state={{ from: `/order-feedback/${orderCode}` }} className="font-medium text-brand hover:underline">Log in</Link> to skip this step.
        </p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-gray-600">
          This order isn&apos;t awaiting feedback right now — it may not be delivered yet, or you&apos;ve already submitted feedback for it.
        </p>
        <Link to="/account" className="mt-3 inline-block text-sm font-medium text-brand hover:underline">Go to My Orders</Link>
      </div>
    );
  }
  if (!order) return <div className="mx-auto max-w-3xl px-4 py-16 text-center text-sm text-gray-500">Loading...</div>;

  const allHandled = Object.values(itemStates).every((s) => s === "confirmed" || s === "reported");

  if (submitted) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-green-600" />
        <h1 className="mt-3 text-xl font-bold text-gray-900">Thanks for your feedback!</h1>
        <p className="mt-1 text-sm text-gray-500">It helps other shoppers and helps us do better.</p>
        <Link to="/shop" className="mt-4 inline-block rounded-md bg-brand px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark">
          Continue Shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <p className="text-sm text-gray-400">
        <Link to="/account" className="hover:text-brand">My Orders</Link> <span className="mx-1">›</span> Order Confirmation & Feedback
      </p>
      <h1 className="mt-1 text-2xl font-bold text-gray-900">Confirm Your Order</h1>
      <p className="mt-1 text-sm text-gray-500">Please verify that all items in your order are correct before submitting your feedback.</p>

      <div className="mt-5 flex flex-wrap items-center gap-6 rounded-lg border border-gray-200 bg-white p-4 text-sm">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-green-100 text-green-700"><Package className="h-4 w-4" /></span>
          <div><p className="text-xs text-gray-400">Order Number</p><p className="font-semibold text-gray-900">{order.order_code}</p></div>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-blue-100 text-blue-700"><Clock className="h-4 w-4" /></span>
          <div>
            <p className="text-xs text-gray-400">Delivered On</p>
            <p className="font-semibold text-gray-900">
              {order.delivered_at ? new Date(order.delivered_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "—"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-purple-100 text-purple-700"><RotateCcw className="h-4 w-4" /></span>
          <div><p className="text-xs text-gray-400">Return Window</p><p className="font-semibold text-gray-900">{daysRemaining(order.delivered_at)} days remaining</p></div>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <span className={`rounded-full px-4 py-1.5 text-sm font-semibold ${step === 1 ? "bg-brand text-white" : "bg-gray-100 text-gray-500"}`}>1  Confirm Items</span>
        <div className="h-px flex-1 bg-gray-200" />
        <span className={`rounded-full px-4 py-1.5 text-sm font-semibold ${step === 2 ? "bg-brand text-white" : "bg-gray-100 text-gray-500"}`}>2  Leave Feedback</span>
      </div>

      {step === 1 ? (
        <div className="mt-5 space-y-4">
          {order.items.map((item) => (
            <ItemCard key={item.id} item={item} state={itemStates[item.id]} contact={contact} onConfirm={handleConfirm} onReport={handleReport} />
          ))}
          <p className="text-center text-xs text-gray-400">
            {allHandled ? "" : "Please confirm or report each item above to proceed"}
          </p>
          {allHandled && (
            <button onClick={() => setStep(2)} className="w-full rounded-md bg-brand py-3 text-sm font-semibold text-white hover:bg-brand-dark">
              Continue to Feedback
            </button>
          )}
        </div>
      ) : (
        <div className="mt-5 space-y-5 rounded-lg border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-brand/10 text-brand"><Star className="h-5 w-5 fill-brand" /></span>
            <div><p className="font-bold text-gray-900">Share Your Feedback</p><p className="text-xs text-gray-500">Rate your experience below</p></div>
          </div>

          <div>
            <h2 className="font-semibold text-gray-900">Rate Your Experience</h2>
            <p className="text-xs text-gray-500">Tell us how we did across each area</p>
            <div className="mt-3 space-y-3">
              {RATING_CATEGORIES.map(({ key, label, hint, icon: Icon }) => (
                <div key={key} className="flex items-center justify-between rounded-md border border-gray-200 p-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-md bg-gray-100 text-gray-500"><Icon className="h-4 w-4" /></span>
                    <div><p className="text-sm font-semibold text-gray-900">{label}</p><p className="text-xs text-gray-400">{hint}</p></div>
                  </div>
                  <StarRow value={ratings[key] || 0} onChange={(v) => setRatings((r) => ({ ...r, [key]: v }))} />
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="font-semibold text-gray-900">Share Your Review</h2>
            <p className="text-xs text-gray-500">Your detailed feedback helps future buyers</p>
            <textarea
              className={`${inputClass} mt-2 min-h-[90px]`}
              maxLength={500}
              placeholder="Tell us what you loved, what could be improved, and anything that stood out about your experience with this order..."
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
            />
            <p className="mt-1 text-right text-xs text-gray-400">{reviewText.length}/500 characters</p>
          </div>

          <div>
            <h2 className="flex items-center gap-1 font-semibold text-gray-900"><Camera className="h-4 w-4" /> Add Photos <span className="font-normal text-gray-400">(optional)</span></h2>
            <PhotoDropzone files={photos} onAdd={addPhotos} onRemove={removePhoto} error={photoError} />
          </div>

          <div>
            <h2 className="font-semibold text-gray-900">Would you recommend Duo Bro Mart to a friend?</h2>
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => setWouldRecommend(true)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-md border py-2 text-sm font-semibold ${wouldRecommend === true ? "border-green-500 bg-green-50 text-green-700" : "border-gray-300 text-gray-600"}`}
              >
                <ThumbsUp className="h-4 w-4" /> Yes, definitely!
              </button>
              <button
                onClick={() => setWouldRecommend(false)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-md border py-2 text-sm font-semibold ${wouldRecommend === false ? "border-red-500 bg-red-50 text-red-700" : "border-gray-300 text-gray-600"}`}
              >
                <ThumbsDown className="h-4 w-4" /> Not really
              </button>
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            onClick={submitFeedback}
            disabled={ratedCount < 5 || submitting}
            className="w-full rounded-md bg-brand py-3 text-sm font-semibold text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-40"
          >
            {ratedCount < 5 ? `Rate all 5 categories to continue (${ratedCount}/5)` : submitting ? "Submitting..." : "Submit Feedback"}
          </button>
        </div>
      )}
    </div>
  );
}

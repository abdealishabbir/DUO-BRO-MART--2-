import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { KeyRound, FileText, Store, Camera, ExternalLink } from "lucide-react";
import { api } from "../../lib/api.js";
import { useAuth } from "../../auth/AuthContext.jsx";
import FormField, { inputClass } from "../../components/FormField.jsx";
import ImageWithFallback from "../../components/ImageWithFallback.jsx";
import Card from "../../components/Card.jsx";
import Button from "../../components/Button.jsx";

const NOTIFICATION_DEFAULTS = [
  { key: "new_order", label: "New Order Received", desc: "Get notified when a customer places an order.", enabled: true },
  { key: "low_stock", label: "Low Stock Alerts", desc: "Alert when any product drops below 10 units.", enabled: true },
  { key: "product_review", label: "Product Review Updates", desc: "Get notified when admin approves or rejects a product.", enabled: true },
];

export default function VendorSettings() {
  const { user } = useAuth();
  const [form, setForm] = useState({ first_name: "", last_name: "", phone_number: "", email: "" });
  const [shopForm, setShopForm] = useState({ shop_name: "", shop_description: "" });
  const [shopLogoPreview, setShopLogoPreview] = useState(null);
  const [shopLogoFile, setShopLogoFile] = useState(null);
  const shopLogoInputRef = useRef(null);
  const [notifications, setNotifications] = useState(NOTIFICATION_DEFAULTS);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [shopSaved, setShopSaved] = useState(false);
  const [shopError, setShopError] = useState("");
  const [shopSaving, setShopSaving] = useState(false);

  useEffect(() => {
    api.get("/account/me/").then((data) => {
      setForm({ first_name: data.first_name ?? "", last_name: data.last_name ?? "", phone_number: data.phone_number ?? "", email: data.email });
      setShopForm({ shop_name: data.shop_name ?? "", shop_description: data.shop_description ?? "" });
      setShopLogoPreview(data.shop_logo ?? null);
    }).catch(() => setError("Couldn't load your account details."));
  }, []);

  const saveProfile = async (e) => {
    e.preventDefault();
    setError("");
    setSaved(false);
    setSaving(true);
    try {
      await api.patch("/account/me/", { first_name: form.first_name, last_name: form.last_name, phone_number: form.phone_number });
      setSaved(true);
    } catch (err) {
      setError(err.data?.detail || "Couldn't save changes. Please check your details and try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleLogoChange = (file) => {
    if (!file) return;
    setShopLogoFile(file);
    setShopLogoPreview(URL.createObjectURL(file));
  };

  const saveShopProfile = async (e) => {
    e.preventDefault();
    setShopError("");
    setShopSaved(false);
    setShopSaving(true);
    try {
      const formData = new FormData();
      formData.append("shop_name", shopForm.shop_name);
      formData.append("shop_description", shopForm.shop_description);
      if (shopLogoFile) formData.append("shop_logo", shopLogoFile);
      const data = await api.patchForm("/account/me/", formData);
      setShopLogoPreview(data.shop_logo ?? null);
      setShopLogoFile(null);
      setShopSaved(true);
    } catch (err) {
      const firstError = err.data && Object.values(err.data).flat()[0];
      setShopError(firstError || err.data?.detail || "Couldn't save your storefront. Please check your details and try again.");
    } finally {
      setShopSaving(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-5">
      <Card padding="none" className="p-5">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-bold text-ink">
            <Store className="h-4 w-4 text-brand" /> Storefront Profile
          </h3>
          {user?.id && (
            <Link to={`/store/${user.id}`} target="_blank" className="flex items-center gap-1 text-xs font-medium text-brand hover:underline">
              View my storefront <ExternalLink className="h-3 w-3" />
            </Link>
          )}
        </div>
        <p className="mt-1 text-xs text-gray-400">
          This is how customers see your shop on your public storefront page and next to your products.
        </p>
        <form onSubmit={saveShopProfile} className="mt-4 space-y-4">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => shopLogoInputRef.current?.click()}
              aria-label="Change shop logo"
              className="group relative h-16 w-16 shrink-0 overflow-hidden rounded-full border border-gray-200 bg-gray-50 focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-brand"
            >
              <ImageWithFallback
                src={shopLogoPreview}
                alt="Shop logo"
                className="h-full w-full object-cover"
                iconClassName="h-6 w-6"
              />
              <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100">
                <Camera className="h-5 w-5 text-white" />
              </span>
            </button>
            <input
              ref={shopLogoInputRef}
              type="file"
              accept="image/jpeg,image/png"
              className="hidden"
              onChange={(e) => handleLogoChange(e.target.files?.[0] ?? null)}
            />
            <div>
              <p className="text-sm font-medium text-ink">Shop Logo</p>
              <p className="text-xs text-gray-400">JPG or PNG, up to 3MB.</p>
            </div>
          </div>

          <FormField label="Shop Name">
            <input
              className={inputClass}
              placeholder={`${form.first_name} ${form.last_name}`.trim() || "Your shop name"}
              value={shopForm.shop_name}
              onChange={(e) => setShopForm({ ...shopForm, shop_name: e.target.value })}
            />
          </FormField>
          <FormField label="About Your Shop">
            <textarea
              className={inputClass}
              rows={3}
              maxLength={1000}
              placeholder="Tell customers what you sell and what makes your shop worth buying from..."
              value={shopForm.shop_description}
              onChange={(e) => setShopForm({ ...shopForm, shop_description: e.target.value })}
            />
          </FormField>

          {shopError && <p className="text-sm text-red-600">{shopError}</p>}
          {shopSaved && <p className="text-sm text-green-700">Storefront updated.</p>}

          <Button type="submit" loading={shopSaving} loadingText="Saving...">
            Save Storefront
          </Button>
        </form>
      </Card>

      <Card padding="none" className="p-5">
        <h3 className="font-bold text-ink">Contact Information</h3>
        <form onSubmit={saveProfile} className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="First Name">
              <input className={inputClass} value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
            </FormField>
            <FormField label="Last Name">
              <input className={inputClass} value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
            </FormField>
          </div>
          <FormField label="Phone Number">
            <input className={inputClass} value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} />
          </FormField>
          <FormField label="Email">
            <input className={`${inputClass} bg-gray-50 text-gray-500`} value={form.email} disabled />
          </FormField>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {saved && <p className="text-sm text-green-700">Saved.</p>}

          <Button type="submit" loading={saving} loadingText="Saving...">
            Save Changes
          </Button>
        </form>
      </Card>

      <Card padding="none" className="p-5">
        <h3 className="font-bold text-ink">Commission & Terms</h3>
        <p className="mt-2 text-sm text-gray-600">
          Current platform commission: <strong className="text-ink">10%</strong> (provisional flat rate — category-based rates land with Admin Settings, §7.7).
        </p>
        <div className="mt-3 flex flex-wrap gap-4">
          <Link to="/vendor/change-password" className="flex items-center gap-1.5 text-sm font-medium text-brand hover:underline">
            <KeyRound className="h-4 w-4" /> Change Password
          </Link>
          <Link to="/vendor-terms" className="flex items-center gap-1.5 text-sm font-medium text-brand hover:underline">
            <FileText className="h-4 w-4" /> Read Vendor Terms & Conditions
          </Link>
        </div>
      </Card>

      <Card padding="none" className="p-5">
        <h3 className="font-bold text-ink">Notifications</h3>
        <p className="mt-1 text-xs text-gray-400">Preferences shown here aren&apos;t saved to your account yet — this is a preview of the upcoming settings.</p>
        <div className="mt-3 space-y-3">
          {notifications.map((n) => (
            <div key={n.key} className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-ink">{n.label}</p>
                <p className="text-xs text-gray-400">{n.desc}</p>
              </div>
              <button
                type="button"
                onClick={() => setNotifications((ns) => ns.map((x) => (x.key === n.key ? { ...x, enabled: !x.enabled } : x)))}
                className={`h-5 w-9 shrink-0 rounded-full transition-colors ${n.enabled ? "bg-brand" : "bg-gray-300"}`}
              >
                <span className={`block h-4 w-4 translate-y-0.5 rounded-full bg-white shadow transition-transform ${n.enabled ? "translate-x-[18px]" : "translate-x-0.5"}`} />
              </button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext.jsx";
import { api } from "../../lib/api.js";
import FormField, { inputClass } from "../../components/FormField.jsx";
import { getOrdersForUser } from "../../cart/CheckoutContext.jsx";
import { formatPKR } from "../../lib/currency.js";

const TABS = ["Profile", "Addresses", "Security", "Orders"];

const PROVINCES = [
  ["punjab", "Punjab"],
  ["sindh", "Sindh"],
  ["khyber_pakhtunkhwa", "Khyber Pakhtunkhwa"],
  ["balochistan", "Balochistan"],
  ["gilgit_baltistan", "Gilgit-Baltistan"],
  ["azad_kashmir", "Azad Kashmir"],
  ["islamabad_ct", "Islamabad Capital Territory"],
];

function ProfileTab() {
  const { user, refreshUser } = useAuth();
  const [firstName, setFirstName] = useState(user?.first_name || "");
  const [lastName, setLastName] = useState(user?.last_name || "");
  const [phone, setPhone] = useState(user?.phone_number || "");
  const [status, setStatus] = useState("");

  const save = async (e) => {
    e.preventDefault();
    setStatus("saving");
    try {
      await api.patch("/account/me/", { first_name: firstName, last_name: lastName, phone_number: phone });
      await refreshUser();
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  };

  return (
    <form onSubmit={save} className="max-w-sm space-y-4">
      {!user.email_verified && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Please verify your email — check your inbox for a confirmation link.
        </p>
      )}
      <FormField label="First name">
        <input className={inputClass} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
      </FormField>
      <FormField label="Last name">
        <input className={inputClass} value={lastName} onChange={(e) => setLastName(e.target.value)} />
      </FormField>
      <FormField label="Phone number">
        <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="03001234567" />
      </FormField>
      <FormField label="Email">
        <input className={`${inputClass} bg-gray-50 text-gray-500`} value={user.email} disabled />
      </FormField>
      <button type="submit" className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
        Save changes
      </button>
      {status === "saved" && <p className="text-sm text-green-600">Saved.</p>}
      {status === "error" && <p className="text-sm text-red-600">Could not save. Try again.</p>}
    </form>
  );
}

function AddressesTab() {
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    label: "Home", full_name: "", phone_number: "", province: "sindh",
    city: "", address_line: "", landmark: "", is_default: false,
  });
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    api.get("/account/addresses/").then((data) => {
      setAddresses(data.results ?? data);
      setLoading(false);
    });
  };

  useEffect(load, []);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await api.post("/account/addresses/", form);
      setShowForm(false);
      setForm({ label: "Home", full_name: "", phone_number: "", province: "sindh", city: "", address_line: "", landmark: "", is_default: false });
      load();
    } catch (err) {
      setError(err.data?.detail || "Could not save this address.");
    }
  };

  const remove = async (id) => {
    await api.delete(`/account/addresses/${id}/`);
    load();
  };

  if (loading) return <p className="text-sm text-gray-500">Loading...</p>;

  return (
    <div className="max-w-lg space-y-4">
      {addresses.length === 0 && !showForm && <p className="text-sm text-gray-500">No saved addresses yet.</p>}

      {addresses.map((addr) => (
        <div key={addr.id} className="flex items-start justify-between rounded-md border border-gray-200 p-3">
          <div className="text-sm">
            <p className="font-medium text-gray-900">
              {addr.label} {addr.is_default && <span className="text-xs text-brand">(default)</span>}
            </p>
            <p className="text-gray-500">{addr.full_name} · {addr.phone_number}</p>
            <p className="text-gray-500">{addr.address_line}, {addr.city}, {PROVINCES.find((p) => p[0] === addr.province)?.[1]}</p>
            {addr.landmark && <p className="text-gray-400">Landmark: {addr.landmark}</p>}
          </div>
          <button onClick={() => remove(addr.id)} className="text-sm text-red-600 hover:underline">
            Remove
          </button>
        </div>
      ))}

      {showForm ? (
        <form onSubmit={submit} className="space-y-3 rounded-md border border-gray-200 p-4">
          <FormField label="Label"><input className={inputClass} value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} /></FormField>
          <FormField label="Full name"><input className={inputClass} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></FormField>
          <FormField label="Phone number"><input className={inputClass} value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} placeholder="03001234567" /></FormField>
          <FormField label="Province">
            <select className={inputClass} value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value })}>
              {PROVINCES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </FormField>
          <FormField label="City"><input className={inputClass} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></FormField>
          <FormField label="Address"><input className={inputClass} value={form.address_line} onChange={(e) => setForm({ ...form, address_line: e.target.value })} /></FormField>
          <FormField label="Landmark (optional, helps rural delivery)">
            <input className={inputClass} value={form.landmark} onChange={(e) => setForm({ ...form, landmark: e.target.value })} />
          </FormField>
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" checked={form.is_default} onChange={(e) => setForm({ ...form, is_default: e.target.checked })} />
            Set as default
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">Save address</button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-md px-4 py-2 text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
          </div>
        </form>
      ) : (
        <button onClick={() => setShowForm(true)} className="text-sm font-medium text-brand hover:underline">
          + Add a new address
        </button>
      )}
    </div>
  );
}

function SecurityTab() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setStatus("saving");
    try {
      await api.post("/account/change-password/", {
        current_password: currentPassword, new_password: newPassword, confirm_password: confirmPassword,
      });
      setStatus("saved");
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    } catch (err) {
      setError(err.data?.detail || "Could not change password.");
      setStatus("");
    }
  };

  return (
    <form onSubmit={submit} className="max-w-sm space-y-4">
      <FormField label="Current password">
        <input type="password" className={inputClass} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
      </FormField>
      <FormField label="New password">
        <input type="password" className={inputClass} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
      </FormField>
      <FormField label="Confirm new password">
        <input type="password" className={inputClass} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
      </FormField>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
        Update password
      </button>
      {status === "saved" && <p className="text-sm text-green-600">Password updated.</p>}
    </form>
  );
}

function OrdersTab() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    // Real Order backend + per-user scoping lands with Phase 5/6 (§10);
    // until then this reads the same localStorage-backed mock orders
    // that CheckoutContext.placeOrder() writes at checkout, filtered to
    // just this account's email so different accounts on the same
    // browser don't see each other's orders.
    setOrders(getOrdersForUser(user?.email));
  }, [user?.email]);

  if (orders.length === 0) {
    return (
      <div className="max-w-lg">
        <p className="text-sm text-gray-500">You haven't placed any orders yet.</p>
        <Link to="/shop" className="mt-2 inline-block text-sm font-medium text-brand hover:underline">
          Start shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-3">
      {orders.map((order) => (
        <div key={order.id} className="rounded-md border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <p className="font-mono text-sm font-semibold text-gray-900">#{order.id}</p>
            <span className="rounded-full bg-cream px-2.5 py-0.5 text-xs font-medium capitalize text-brand">
              {order.trackingStatus ?? "pending"}
            </span>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Placed {new Date(order.placedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
            {" · "}{order.items.length} item{order.items.length !== 1 && "s"}
          </p>
          <div className="mt-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-900">{formatPKR(order.total)}</p>
            <Link to={`/track-order?order=${order.id}`} className="text-sm font-medium text-brand hover:underline">
              Track Order
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Account() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("Profile");

  useEffect(() => {
    if (!loading && !user) navigate("/login", { state: { from: "/account" }, replace: true });
  }, [loading, user, navigate]);

  if (loading || !user) return null;

  const handleLogout = async () => {
    await logout();
    navigate("/", { replace: true });
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">My account</h1>
        <button onClick={handleLogout} className="text-sm text-gray-500 hover:text-brand">
          Log out
        </button>
      </div>

      <div className="mt-6 flex gap-6 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-1 pb-3 text-sm font-medium ${
              tab === t ? "border-brand text-brand" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "Profile" && <ProfileTab />}
        {tab === "Addresses" && <AddressesTab />}
        {tab === "Security" && <SecurityTab />}
        {tab === "Orders" && <OrdersTab />}
      </div>
    </div>
  );
}

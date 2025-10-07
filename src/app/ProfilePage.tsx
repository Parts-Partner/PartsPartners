// src/app/ProfilePage.tsx
import React, { useEffect, useState } from "react";
import { useAuth } from "context/AuthContext";
import {
  LogOut,
  Edit,
  ShoppingBag,
  Percent,
  Mail,
  Phone,
  Building2,
  UserRound,
  ShieldCheck,
  CheckCircle2,
  Loader2,
  MapPin,
  CreditCard,
  Upload,
  X,
} from "lucide-react";
import { supabase } from "services/supabaseClient";

type Props = { onNav: (page: string) => void };

type EditableProfile = {
  full_name: string;
  phone?: string;
  company_name?: string;
  avatar_url?: string;
};

type Address = {
  id?: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
  is_default?: boolean;
  type?: "shipping" | "billing";
};

type PaymentMethod = {
  id: string;
  last4: string;
  brand: string;
  exp_month: number;
  exp_year: number;
  is_default: boolean;
};

const LoginPrompt: React.FC<{ onNav: (page: string) => void }> = ({ onNav }) => (
  <div className="mx-auto max-w-3xl p-6">
    <h1 className="mb-4 text-2xl font-bold">Please sign in</h1>
    <button
      className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700"
      onClick={() => onNav("login")}
    >
      Go to Login
    </button>
  </div>
);

const EmptyState: React.FC<{ title: string; hint?: string; action?: React.ReactNode }> = ({
  title,
  hint,
  action,
}) => (
  <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
    <div className="mx-auto mb-3 h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center">
      <ShoppingBag className="h-5 w-5 text-slate-500" />
    </div>
    <div className="font-semibold text-slate-900">{title}</div>
    {hint && <div className="mt-1 text-sm text-slate-600">{hint}</div>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

const EditProfileModal: React.FC<{
  open: boolean;
  initial: EditableProfile;
  user: any;
  onClose: () => void;
  onSaved: (next: EditableProfile) => void;
}> = ({ open, initial, user, onClose, onSaved }) => {
  const [form, setForm] = useState<EditableProfile>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(initial);
      setError("");
    }
  }, [open, initial]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be smaller than 5MB");
      return;
    }

    setUploadingImage(true);
    setError("");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const ext = file.name.split(".").pop();
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;

      const { data: uploaded, error: uploadErr } = await supabase.storage
        .from("avatars")
        .upload(path, file);
      if (uploadErr) throw uploadErr;

      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(uploaded.path);
      setForm((p) => ({ ...p, avatar_url: publicUrl }));
    } catch (err: any) {
      setError(err.message || "Failed to upload image");
    } finally {
      setUploadingImage(false);
    }
  };

  const save = async () => {
    console.log('🟢 SAVE STARTED');
    setSaving(true);
    setError("");

    try {
      if (!user?.id) throw new Error("User not authenticated");
      console.log('✅ User:', user.id);

      console.log('📡 Calling update-profile...');
      const response = await fetch('/.netlify/functions/update-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          profile: {
            full_name: form.full_name,
            phone: form.phone || null,
            company_name: form.company_name || null,
            avatar_url: form.avatar_url || null
          }
        })
      });
      
      console.log('📡 Response status:', response.status);

      if (!response.ok) throw new Error('Failed to update profile');
      console.log('✅ Profile updated');

      // Update auth metadata
      await supabase.auth.updateUser({
        data: {
          full_name: form.full_name,
          phone: form.phone || "",
          company_name: form.company_name || "",
          avatar_url: form.avatar_url || "",
        },
      });

      onSaved(form);
      onClose();
    } catch (e: any) {
      console.error('❌ Save error:', e);
      setError(e?.message || "Failed to save profile");
    } finally {
      console.log('🏁 Save complete');
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
        <div className="border-b border-slate-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-semibold text-slate-900">
              <Edit className="h-4 w-4" />
              Edit Profile
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700">Profile Picture</label>
            <div className="mt-2 flex items-center gap-4">
              <img
                src={
                  form.avatar_url ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(form.full_name || "User")}`
                }
                alt="Profile"
                className="h-16 w-16 rounded-full object-cover border"
              />
              <div>
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  disabled={uploadingImage}
                />
                <label
                  htmlFor="avatar-upload"
                  className="inline-flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg text-sm font-medium cursor-pointer hover:bg-slate-50 disabled:opacity-50"
                >
                  {uploadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {uploadingImage ? "Uploading..." : "Upload Photo"}
                </label>
                <div className="text-xs text-slate-500 mt-1">Max 5MB. JPG, PNG, GIF</div>
              </div>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Full Name</label>
            <div className="relative mt-1">
              <UserRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                className="w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                value={form.full_name}
                onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))}
                placeholder="Your name"
                required
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Company (optional)</label>
            <div className="relative mt-1">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                className="w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                value={form.company_name || ""}
                onChange={(e) => setForm((p) => ({ ...p, company_name: e.target.value }))}
                placeholder="Company"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Phone (optional)</label>
            <div className="relative mt-1">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                className="w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                value={form.phone || ""}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                placeholder="(555) 555-5555"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-6 py-3">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving || uploadingImage || !form.full_name.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-700 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

const AddressModal: React.FC<{
  open: boolean;
  address: Address | null;
  type: "shipping" | "billing";
  onClose: () => void;
  onSaved: () => void;
}> = ({ open, address, type, onClose, onSaved }) => {
  const [form, setForm] = useState<Address>({
    line1: "",
    line2: "",
    city: "",
    state: "",
    zip_code: "",
    country: "US",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setForm(
        address || {
          line1: "",
          line2: "",
          city: "",
          state: "",
          zip_code: "",
          country: "US",
        }
      );
      setError("");
    }
  }, [open, address]);

  const save = async () => {
    console.log('🔥 SAVE FUNCTION CALLED'); // ADD THIS LINE
    setSaving(true);
    setError("");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const response = await fetch('/.netlify/functions/save-address', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          address: form,
          type: type,
          addressId: address?.id || null
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save address');
      }

      onSaved();
      onClose();
    } catch (e: any) {
      setError(e?.message || "Failed to save address");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
        <div className="border-b border-slate-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-semibold text-slate-900">
              <MapPin className="h-4 w-4" />
              {address ? "Edit" : "Add"} {type === "shipping" ? "Shipping" : "Billing"} Address
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700">Address Line 1</label>
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
              value={form.line1}
              onChange={(e) => setForm((p) => ({ ...p, line1: e.target.value }))}
              placeholder="123 Main St"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Address Line 2 (optional)</label>
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
              value={form.line2 || ""}
              onChange={(e) => setForm((p) => ({ ...p, line2: e.target.value }))}
              placeholder="Apt, Suite, Unit"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-slate-700">City</label>
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                value={form.city}
                onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
                placeholder="City"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">State</label>
              <select
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                value={form.state}
                onChange={(e) => setForm((p) => ({ ...p, state: e.target.value }))}
                required
              >
                <option value="">Select State</option>
                {[
                  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
                ].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">ZIP Code</label>
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
              value={form.zip_code}
              onChange={(e) => setForm((p) => ({ ...p, zip_code: e.target.value }))}
              placeholder="12345"
              required
            />
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-6 py-3">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={
              saving ||
              !form.line1.trim() ||
              !form.city.trim() ||
              !form.state ||
              !form.zip_code.trim()
            }
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-700 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Save Address
          </button>
        </div>
      </div>
    </div>
  );
};

const ProfilePage: React.FC<Props> = ({ onNav }) => {
  const { user, logout, profile } = useAuth() as any;

  const [userProfile, setUserProfile] = useState<EditableProfile>({
    full_name: "",
    phone: "",
    company_name: "",
    avatar_url: "",
  });

  // Addresses
  const [shippingAddress, setShippingAddress] = useState<Address | null>(null);
  const [billingAddress, setBillingAddress] = useState<Address | null>(null);
  const [addrError, setAddrError] = useState<string>("");

  // Payments
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [payError, setPayError] = useState<string>("");

  // Orders
  const [orders, setOrders] = useState<any[] | null>(null);
  const [ordersError, setOrdersError] = useState<string>("");

  // Loading flags
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [loadingAddresses, setLoadingAddresses] = useState(true);
  const [loadingPayments, setLoadingPayments] = useState(true);

  // Profile from context → local state
  useEffect(() => {
    if (user) {
      setUserProfile({
        full_name: profile?.full_name || user.user_metadata?.full_name || user.name || "",
        phone: profile?.phone || user.user_metadata?.phone || "",
        company_name: profile?.company_name || user.user_metadata?.company_name || "",
        avatar_url: profile?.avatar_url || user.user_metadata?.avatar_url || user.avatar_url || "",
      });
    }
  }, [user, profile]);

  // Load addresses
  useEffect(() => {
    let alive = true;
    setAddrError("");
    setLoadingAddresses(true);

    if (!user?.id) {
      setLoadingAddresses(false);
      return () => { alive = false; };
    }

    (async () => {
      try {
        const response = await fetch('/.netlify/functions/profile-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id })
        });
        
        if (!response.ok) throw new Error('Failed to load profile data');
        
        const { addresses } = await response.json();
        
        if (!alive) return;
        const ship = addresses?.find((a: Address) => a.type === "shipping" && a.is_default) || null;
        const bill = addresses?.find((a: Address) => a.type === "billing" && a.is_default) || null;
        setShippingAddress(ship);
        setBillingAddress(bill);

      } catch (e: any) {
        if (alive) {
          setAddrError(e?.message || "Could not load addresses");
          setShippingAddress(null);
          setBillingAddress(null);
        }
      } finally {
        if (alive) setLoadingAddresses(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [user?.id]);

  // Load payment methods (try payment_methods, then payments)
// Load payment methods
useEffect(() => {
  let alive = true;
  setPayError("");
  setLoadingPayments(true);

  if (!user?.id) {
    setLoadingPayments(false);
    return () => { alive = false; };
  }

  (async () => {
    try {
      const response = await fetch('/.netlify/functions/profile-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });
      
      if (!response.ok) throw new Error('Failed to load profile data');
      
      const { paymentMethods } = await response.json();
      
      if (alive) {
        setPaymentMethods(paymentMethods || []);
        setLoadingPayments(false);
      }
    } catch (e: any) {
      if (alive) {
        setPayError(e?.message || "Could not load payment methods");
        setPaymentMethods([]);
        setLoadingPayments(false);
      }
    }
  })();

  return () => {
    alive = false;
  };
}, [user?.id]);

  // Load orders
  useEffect(() => {
    let alive = true;
    setOrdersError("");
    setLoadingOrders(true);

    if (!user?.id) {
      setOrders([]);
      setLoadingOrders(false);
      return () => { alive = false; };
    }

    (async () => {
      try {
        const response = await fetch('/.netlify/functions/profile-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id })
        });
        
        if (!response.ok) throw new Error('Failed to load profile data');
        
        const { orders } = await response.json();
        
        if (alive) {
          setOrders(orders || []);
          setLoadingOrders(false);
        }
      } catch (e: any) {
        if (alive) {
          setOrdersError(e?.message || "Could not load orders");
          setOrders([]);
          setLoadingOrders(false);
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, [user?.id]);

  const handleAddressEdit = (type: "shipping" | "billing") => {
    setAddressModalType(type);
    setEditingAddress(type === "shipping" ? shippingAddress : billingAddress);
    setAddressModalOpen(true);
  };

  const [editOpen, setEditOpen] = useState(false);
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [addressModalType, setAddressModalType] = useState<"shipping" | "billing">("shipping");
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);

  const refreshAddresses = async () => {
    if (!user?.id) return;
    try {
      const response = await fetch('/.netlify/functions/profile-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });
      
      if (!response.ok) throw new Error('Failed to refresh addresses');
      
      const { addresses } = await response.json();
            
      const ship = addresses?.find((a: Address) => a.type === "shipping" && a.is_default) || null;
      const bill = addresses?.find((a: Address) => a.type === "billing" && a.is_default) || null;
      setShippingAddress(ship);
      setBillingAddress(bill);
    } catch (e) {
      console.error("Error refreshing addresses:", e);
    }
  };

  const refreshProfile = async () => {
    if (!user?.id) return;
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;
      
      // Profile data is in user metadata after update
      setUserProfile({
        full_name: authUser.user_metadata?.full_name || "",
        phone: authUser.user_metadata?.phone || "",
        company_name: authUser.user_metadata?.company_name || "",
        avatar_url: authUser.user_metadata?.avatar_url || "",
      });
    } catch (err) {
      console.error("Error refreshing profile:", err);
    }
  };

  if (!user) return <LoginPrompt onNav={onNav} />;

  const discountPct = profile?.discount_percentage || 0;

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:flex-row md:items-center">
        <img
          src={
            userProfile.avatar_url ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(userProfile.full_name || "User")}`
          }
          alt="Profile"
          className="h-24 w-24 rounded-full border object-cover"
        />

        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">
              {userProfile.full_name || "User"}
            </h1>
            {discountPct > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-sm font-medium text-green-800">
                <Percent className="h-4 w-4" />
                {discountPct}% Preferred Pricing
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600">
            <span className="inline-flex items-center gap-1">
              <Mail className="h-4 w-4" />
              {user.email}
            </span>
            {userProfile.phone ? (
              <span className="inline-flex items-center gap-1">
                <Phone className="h-4 w-4" />
                {userProfile.phone}
              </span>
            ) : null}
            {userProfile.company_name ? (
              <span className="inline-flex items-center gap-1">
                <Building2 className="h-4 w-4" />
                {userProfile.company_name}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 hover:bg-slate-50"
            onClick={() => setEditOpen(true)}
          >
            <Edit className="h-4 w-4" />
            Edit Profile
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 font-semibold text-white hover:bg-red-700"
            onClick={logout}
          >
            <LogOut className="h-4 w-4" />
            Log Out
          </button>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4">
          <div>
            <div className="font-semibold text-slate-900">Account Status</div>
            <div className="text-sm text-slate-600">
              {discountPct > 0 ? "Service company approved" : "Standard account"}
            </div>
          </div>
          <ShieldCheck className="h-5 w-5 text-slate-500" />
        </div>
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4">
          <div>
            <div className="font-semibold text-slate-900">Security</div>
            <div className="text-sm text-slate-600">Reset password in settings</div>
          </div>
          <UserRound className="h-5 w-5 text-slate-500" />
        </div>
        <button
          onClick={() => onNav("search")}
          className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 hover:shadow transition-shadow"
        >
          <div>
            <div className="font-semibold text-slate-900">Browse Parts</div>
            <div className="text-sm text-slate-600">Find what you need</div>
          </div>
          <ShoppingBag className="h-5 w-5 text-slate-500" />
        </button>
      </div>

      {/* Addresses */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Shipping */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Default Shipping Address
            </h3>
            <button
              onClick={() => handleAddressEdit("shipping")}
              className="text-sm font-medium text-red-600 hover:text-red-700"
            >
              {shippingAddress ? "Edit" : "Add"}
            </button>
          </div>
          {loadingAddresses ? (
            <div className="flex items-center gap-2 text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : addrError ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {addrError}
            </div>
          ) : shippingAddress ? (
            <div className="text-sm text-slate-600">
              <div>{shippingAddress.line1}</div>
              {shippingAddress.line2 && <div>{shippingAddress.line2}</div>}
              <div>
                {shippingAddress.city}, {shippingAddress.state} {shippingAddress.zip_code}
              </div>
            </div>
          ) : (
            <div className="text-slate-500 text-sm">No shipping address on file</div>
          )}
        </div>

        {/* Billing */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Default Billing Address
            </h3>
            <button
              onClick={() => handleAddressEdit("billing")}
              className="text-sm font-medium text-red-600 hover:text-red-700"
            >
              {billingAddress ? "Edit" : "Add"}
            </button>
          </div>
          {loadingAddresses ? (
            <div className="flex items-center gap-2 text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : addrError ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {addrError}
            </div>
          ) : billingAddress ? (
            <div className="text-sm text-slate-600">
              <div>{billingAddress.line1}</div>
              {billingAddress.line2 && <div>{billingAddress.line2}</div>}
              <div>
                {billingAddress.city}, {billingAddress.state} {billingAddress.zip_code}
              </div>
            </div>
          ) : (
            <div className="text-slate-500 text-sm">No billing address on file</div>
          )}
        </div>
      </div>

      {/* Payment Methods */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900 flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Saved Payment Methods
          </h3>
          <button
            onClick={() => alert("Payment method management coming soon!")}
            className="text-sm font-medium text-red-600 hover:text-red-700"
          >
            Add Payment Method
          </button>
        </div>
        {loadingPayments ? (
          <div className="flex items-center gap-2 text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading payment methods…
          </div>
        ) : payError ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {payError}
          </div>
        ) : paymentMethods.length > 0 ? (
          <div className="space-y-3">
            {paymentMethods.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between rounded-lg border border-slate-200 p-3"
              >
                <div className="flex items-center gap-3">
                  <CreditCard className="h-5 w-5 text-slate-400" />
                  <div>
                    <div className="font-medium text-slate-900">•••• •••• •••• {m.last4}</div>
                    <div className="text-sm text-slate-600">
                      {m.brand.toUpperCase()} • Expires {m.exp_month}/{m.exp_year}
                    </div>
                  </div>
                </div>
                {m.is_default && (
                  <span className="rounded-full bg-green-100 px-2 py-1 text-xs text-green-800">
                    Default
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-slate-500 text-sm">
            No saved payment methods. Payment methods will be saved during checkout for future use.
          </div>
        )}
      </div>

      {/* Orders */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">Recent Orders</h2>
          <button
            onClick={() => onNav("search")}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            Start Shopping
          </button>
        </div>

        {loadingOrders ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex items-center gap-2 text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading orders…
            </div>
          </div>
        ) : ordersError ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {ordersError}
          </div>
        ) : orders && orders.length > 0 ? (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-slate-600">
                  <th className="px-4 py-3">Order #</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Total</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-medium text-slate-900">{o.po_number}</td>
                    <td className="px-4 py-3">
                      {new Date(o.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          o.status === "completed"
                            ? "bg-green-100 text-green-800"
                            : o.status === "submitted"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {o.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">${Number(o.total_amount).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No orders yet."
            hint="When you place an order, it will show here."
            action={
              <button
                onClick={() => onNav("search")}
                className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700"
              >
                Browse Parts
              </button>
            }
          />
        )}
      </div>

      {/* Modals */}
      <EditProfileModal
        open={editOpen}
        initial={userProfile}
        user={user}
        onClose={() => setEditOpen(false)}
        onSaved={async (updated) => {
          setUserProfile(updated); // optimistic
          await refreshProfile();  // canonical refetch
        }}
      />
      <AddressModal
        open={addressModalOpen}
        address={editingAddress}
        type={addressModalType}
        onClose={() => {
          setAddressModalOpen(false);
          setEditingAddress(null);
        }}
        onSaved={refreshAddresses}
      />
    </div>
  );
};

export default ProfilePage;

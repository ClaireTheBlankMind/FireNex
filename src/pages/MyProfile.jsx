
import { useEffect, useState } from "react";
import {
  UserRound,
  Mail,
  ShieldCheck,
  CalendarDays,
  Save,
  RefreshCw,
  CircleCheck,
  AlertCircle,
  Pencil,
  X,
} from "lucide-react";
import { supabase } from "../lib/supabase.js";
import AccountPageLayout from "../components/AccountPageLayout";

export default function MyProfile({ onBack }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [fullName, setFullName] = useState("");
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

    async function loadProfile() {
    setLoading(true);
    setError("");

    try {
      // ⭐ OFFLINE FALLBACK — use cached profile if no network
      if (!navigator.onLine) {
        const cached = localStorage.getItem("firenex_profile");
        if (cached) {
          const parsed = JSON.parse(cached);
          setProfile(parsed);
          setFullName(parsed.full_name || "");
          setUser({ email: parsed.email || "Cached user" });
          setLoading(false);
          return;
        } else {
          throw new Error("You are offline and your profile is not cached on this device.");
        }
      }

      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData.user) {
        throw new Error("Please sign in to view your profile.");
      }

      setUser(authData.user);

      const { data, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, role, active, created_at")
        .eq("id", authData.user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      if (!data) {
        throw new Error("Your profile record was not found. Please contact your system administrator.");
      }

      setProfile(data);
      setFullName(data.full_name || "");

      // ⭐ Keep local cache fresh — also update the AuthGate's cache
      localStorage.setItem("firenex_profile", JSON.stringify(data));
    } catch (err) {
      // ⭐ Last-resort fallback — if fetch fails midway, use cache
      const cached = localStorage.getItem("firenex_profile");
      if (cached) {
        const parsed = JSON.parse(cached);
        setProfile(parsed);
        setFullName(parsed.full_name || "");
        setUser({ email: parsed.email || "Cached user" });
      } else {
        setError(err.message || "Unable to load your profile.");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProfile();
  }, []);

    async function saveProfile(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    const trimmedName = fullName.trim();

    if (trimmedName.length < 2) {
      setError("Please enter a full name with at least 2 characters.");
      return;
    }

    if (trimmedName.length > 100) {
      setError("Full name must not exceed 100 characters.");
      return;
    }

    // ⭐ Block saves while offline
    if (!navigator.onLine) {
      setError("You are offline. Profile changes can only be saved when connected.");
      return;
    }

    setSaving(true);

    try {
      const { data, error: updateError } = await supabase
        .from("profiles")
        .update({ full_name: trimmedName })
        .eq("id", user.id)
        .select("id, full_name, role, active, created_at")
        .single();

      if (updateError) throw updateError;

      setProfile(data);
      setFullName(data.full_name || "");
      setEditing(false);
      setMessage("Your profile was updated successfully.");
    } catch (err) {
      setError(
        err.code === "42501"
          ? "Permission denied. Check your Supabase profile update policy."
          : err.message || "Unable to save your profile."
      );
    } finally {
      setSaving(false);
    }
  }

  const displayName = profile?.full_name || user?.email || "BFP Personnel";
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <AccountPageLayout
      title="My Profile"
      description="Manage your personal information and view your FireNex account details."
      icon={UserRound}
      onBack={onBack}
    >
      {loading ? (
        <div className="account-card account-loading">
          <RefreshCw className="spin-icon" size={22} />
          Loading your profile...
        </div>
      ) : (
        <>
          {error && (
            <div className="account-alert account-alert-error">
              <AlertCircle size={19} />
              <span>{error}</span>
            </div>
          )}

          {message && (
            <div className="account-alert account-alert-success">
              <CircleCheck size={19} />
              <span>{message}</span>
            </div>
          )}

          <section className="profile-hero account-card">
            <div className="profile-large-avatar">{initials}</div>

            <div className="profile-hero-info">
              <span className="account-eyebrow">MY ACCOUNT</span>
              <h2>{displayName}</h2>
              <p>{user?.email}</p>

              <div className="profile-badges">
                <span className="account-tag">
                  <ShieldCheck size={14} />
                  {profile?.role === "bfp_personnel"
                    ? "BFP Personnel"
                    : profile?.role || "Role not assigned"}
                </span>

                <span
                  className={`account-tag ${
                    profile?.active
                      ? "account-tag-success"
                      : "account-tag-danger"
                  }`}
                >
                  {profile?.active ? "Active" : "Inactive"}
                </span>
              </div>
            </div>

            <button
              type="button"
              className="account-secondary-button"
              onClick={() => {
                setEditing((value) => !value);
                setError("");
                setMessage("");
              }}
            >
              {editing ? <X size={17} /> : <Pencil size={17} />}
              {editing ? "Cancel" : "Edit Profile"}
            </button>
          </section>

          {editing && (
            <form className="account-card profile-edit-form" onSubmit={saveProfile}>
              <div className="account-section-heading">
                <div>
                  <h2>Edit Personal Information</h2>
                  <p>Update the name displayed in your account.</p>
                </div>
              </div>

              <label className="account-field">
                <span>Full Name</span>
                <input
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  maxLength={100}
                  placeholder="Enter your full name"
                  required
                />
              </label>

              <label className="account-field">
                <span>Email Address</span>
                <input value={user?.email || ""} readOnly disabled />
                <small>
                  Email is managed by Supabase Authentication.
                </small>
              </label>

              <div className="account-form-actions">
                <button
                  type="button"
                  className="account-secondary-button"
                  onClick={() => {
                    setFullName(profile?.full_name || "");
                    setEditing(false);
                    setError("");
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="account-primary-button"
                  disabled={saving}
                >
                  <Save size={17} />
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          )}

          <section className="account-card">
            <div className="account-section-heading">
              <div>
                <h2>Personal Information</h2>
                <p>Your account information stored in the system.</p>
              </div>
            </div>

            <div className="account-info-grid">
              <div className="account-info-item">
                <UserRound size={21} />
                <div>
                  <span>Full Name</span>
                  <strong>{profile?.full_name || "Not provided"}</strong>
                </div>
              </div>

              <div className="account-info-item">
                <Mail size={21} />
                <div>
                  <span>Email Address</span>
                  <strong>{user?.email || "Not available"}</strong>
                </div>
              </div>

              <div className="account-info-item">
                <ShieldCheck size={21} />
                <div>
                  <span>Account Role</span>
                  <strong>
                    {profile?.role === "bfp_personnel"
                        ? "BFP Personnel"
                        : profile?.role || "Not assigned"}
                  </strong>
                </div>
              </div>

              <div className="account-info-item">
                <CalendarDays size={21} />
                <div>
                  <span>Date Registered</span>
                  <strong>
                    {profile?.created_at
                      ? new Date(profile.created_at).toLocaleDateString(
                          undefined,
                          {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          }
                        )
                      : "Not available"}
                  </strong>
                </div>
              </div>
            </div>

            <button
              type="button"
              className="account-text-button"
              onClick={loadProfile}
            >
              <RefreshCw size={15} />
              Refresh profile information
            </button>
          </section>

          <section className="account-card">
            <div className="account-readonly-row">
              <span>Account status</span>
              <strong>{profile?.active ? "Active" : "Inactive"}</strong>
            </div>
            <div className="account-readonly-row">
              <span>Authentication provider</span>
              <strong>Supabase Auth</strong>
            </div>
          </section>
        </>
      )}
    </AccountPageLayout>
  );
}

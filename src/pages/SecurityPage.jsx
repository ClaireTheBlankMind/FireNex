
import { useState } from "react";
import {
  ShieldCheck,
  KeyRound,
  LockKeyhole,
  Mail,
  CircleCheck,
  AlertCircle,
  RefreshCw,
  LogOut,
  Info,
} from "lucide-react";
import { supabase } from "../lib/supabase.js";
import AccountPageLayout from "../components/AccountPageLayout";

export default function SecurityPage({ onBack }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function loadAccount() {
    setLoading(true);
    setError("");

    try {
      const { data, error: authError } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!data.user) {
        throw new Error("No signed-in user was found.");
      }

      setEmail(data.user.email || "");
    } catch (err) {
      setError(err.message || "Unable to load account security information.");
    } finally {
      setLoading(false);
    }
  }

  async function sendPasswordReset() {
    setError("");
    setMessage("");

    if (!email) {
      setError("Your account email could not be retrieved.");
      return;
    }

    setSending(true);

    try {
      const redirectTo = `${window.location.origin}/reset-password`;

      const { error: resetError } =
        await supabase.auth.resetPasswordForEmail(email, {
          redirectTo,
        });

      if (resetError) throw resetError;

      setMessage(
        "Password reset requested. Check your email inbox and spam folder for the recovery link."
      );
    } catch (err) {
      setError(err.message || "Unable to request password recovery.");
    } finally {
      setSending(false);
    }
  }

  async function signOut() {
    setSigningOut(true);
    setError("");

    try {
      const { error: signOutError } = await supabase.auth.signOut();

      if (signOutError) throw signOutError;

      // Your existing authentication guard should redirect to login.
      window.location.assign("/");
    } catch (err) {
      setError(err.message || "Unable to sign out.");
      setSigningOut(false);
    }
  }

  return (
    <AccountPageLayout
      title="Security"
      description="Protect your FireNex account and manage password recovery."
      icon={ShieldCheck}
      onBack={onBack}
    >
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

      <section className="security-status-banner">
        <div className="security-status-icon">
          <ShieldCheck size={28} />
        </div>
        <div>
          <span className="account-eyebrow">ACCOUNT PROTECTION</span>
          <h2>Keep your account secure</h2>
          <p>
            Use your authorized account, keep your password private, and
            sign out when using a shared computer.
          </p>
        </div>
        <span className="account-tag account-tag-success">
          Authentication enabled
        </span>
      </section>

      <div className="security-page-grid">
        <section className="account-card">
          <div className="security-card-heading">
            <div className="settings-row-icon">
              <KeyRound size={22} />
            </div>
            <div>
              <h2>Password Recovery</h2>
              <p>Request a secure password reset link.</p>
            </div>
          </div>

          <label className="account-field">
            <span>Signed-in Email Address</span>
            <div className="account-input-with-icon">
              <Mail size={18} />
              <input
                type="email"
                value={loading ? "Loading account..." : email}
                readOnly
                disabled={loading}
              />
            </div>
          </label>

          <p className="account-muted">
            Supabase will send a recovery email if your authentication
            configuration allows it. Follow the link in that email to reset
            your password.
          </p>

          <button
            type="button"
            className="account-primary-button"
            onClick={sendPasswordReset}
            disabled={loading || sending || !email}
          >
            <KeyRound size={17} />
            {sending ? "Requesting..." : "Send Password Reset Link"}
          </button>

          <button
            type="button"
            className="account-text-button"
            onClick={loadAccount}
          >
            <RefreshCw size={15} />
            Refresh account information
          </button>
        </section>

        <section className="account-card">
          <div className="security-card-heading">
            <div className="settings-row-icon">
              <LockKeyhole size={22} />
            </div>
            <div>
              <h2>Security Checklist</h2>
              <p>Recommended practices for BFP personnel.</p>
            </div>
          </div>

          <ul className="security-checklist">
            <li>
              <CircleCheck size={18} />
              <span>Use a strong, unique password.</span>
            </li>
            <li>
              <CircleCheck size={18} />
              <span>Never share your login credentials.</span>
            </li>
            <li>
              <CircleCheck size={18} />
              <span>Verify incident information before dispatching units.</span>
            </li>
            <li>
              <CircleCheck size={18} />
              <span>Sign out on shared or public computers.</span>
            </li>
          </ul>

          <div className="settings-info">
            <Info size={18} />
            <span>
              Administrator and personnel permissions should be enforced
              by Supabase Row Level Security policies, not only by the UI.
            </span>
          </div>
        </section>

        <section className="account-card security-session-card">
          <div className="security-card-heading">
            <div className="settings-row-icon">
              <LogOut size={22} />
            </div>
            <div>
              <h2>Sign Out</h2>
              <p>End your current FireNex session on this application.</p>
            </div>
          </div>

          {!showSignOutConfirm ? (
            <button
              type="button"
              className="account-danger-button"
              onClick={() => setShowSignOutConfirm(true)}
            >
              <LogOut size={17} />
              Sign Out of FireNex
            </button>
          ) : (
            <div className="security-confirm">
              <p>Are you sure you want to sign out?</p>
              <div className="account-form-actions">
                <button
                  type="button"
                  className="account-secondary-button"
                  onClick={() => setShowSignOutConfirm(false)}
                  disabled={signingOut}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="account-danger-button"
                  onClick={signOut}
                  disabled={signingOut}
                >
                  {signingOut ? "Signing out..." : "Confirm Sign Out"}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </AccountPageLayout>
  );
}

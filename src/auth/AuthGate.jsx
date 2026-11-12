import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";
import App from "../App.jsx";

function LoginForm() {
  const [view, setView] = useState("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function changeView(nextView) {
    setView(nextView);
    setError("");
    setNotice("");
    setPassword("");
    setShowPassword(false);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    setSubmitting(true);

    try {
      if (view === "login") {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          setError(error.message);
          return;
        }

        // Record the successful login.
        const { error: logError } = await supabase.rpc("log_successful_login");
        if (logError) {
          console.error("Failed to record login:", logError);
        }
      } else if (view === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: fullName.trim(),
            },
          },
        });

        if (error) throw error;

        if (data.session) {
          const { error: signOutError } = await supabase.auth.signOut();
          if (signOutError) {
            throw signOutError;
          }
        }

        setNotice(
          data.session
            ? "Registration submitted. Please wait for Superadmin approval before signing in."
            : "Registration successful. Confirm your email if requested, then wait for Superadmin approval."
        );

        setPassword("");
        setView("login");
      } else if (view === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(
          email.trim(),
          {
            redirectTo: window.location.origin,
          }
        );

        if (error) throw error;

        setNotice(
          "If an account exists for this email, a password-reset link will be sent. Please check your inbox and spam folder."
        );
      }
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const isLogin = view === "login";
  const isSignup = view === "signup";
  const isForgot = view === "forgot";

  return (
    <main className="sos-auth-page">
      <section className="sos-auth-card">
        <div className="sos-auth-icon">
          <img src="/images/FireNex Fire-Logo.png" alt="FireNex Logo" />
        </div>

        <p className="sos-auth-eyebrow">BUREAU OF FIRE PROTECTION</p>

        <p className="sos-auth-subtitle">
          {isLogin
            ? "Fire Detection, Dispatch & Response Monitoring System"
            : isSignup
            ? "Request authorized access to the FireNex platform"
            : "Receive a secure link to reset your password"}
        </p>

        <form onSubmit={handleSubmit}>
          {isSignup && (
            <>
              <label htmlFor="sos-full-name">Full name</label>
              <input
                id="sos-full-name"
                type="text"
                autoComplete="name"
                placeholder="Enter your full name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                required
              />
            </>
          )}

          <label htmlFor="sos-email">Email address</label>
          <input
            id="sos-email"
            type="email"
            autoComplete="email"
            placeholder="Enter your email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />

          {(isLogin || isSignup) && (
            <>
              <label htmlFor="sos-password">Password</label>
              <div className="sos-password-wrapper">
                <input
                  id="sos-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={isLogin ? "current-password" : "new-password"}
                  placeholder={isSignup ? "Create a password" : "Enter your password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={6}
                  required
                />
                <button
                  className="sos-password-toggle"
                  type="button"
                  onClick={() => setShowPassword((previous) => !previous)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </>
          )}

          {error && (
            <p className="sos-auth-error" role="alert">
              {error}
            </p>
          )}

          {notice && (
            <p className="sos-auth-notice" role="status">
              {notice}
            </p>
          )}

          <button className="sos-auth-button" type="submit" disabled={submitting}>
            {submitting
              ? "Please wait..."
              : isLogin
              ? "Sign in securely"
              : isSignup
              ? "Request account"
              : "Send reset link"}
          </button>
        </form>

        <div className="sos-auth-links">
          {isLogin && (
            <>
              <button
                type="button"
                className="sos-auth-link"
                onClick={() => changeView("forgot")}
              >
                Forgot password?
              </button>
              <p>
                Need an account?{" "}
                <button
                  type="button"
                  className="sos-auth-link"
                  onClick={() => changeView("signup")}
                >
                  Create account
                </button>
              </p>
            </>
          )}

          {!isLogin && (
            <button
              type="button"
              className="sos-auth-link"
              onClick={() => changeView("login")}
            >
              Back to sign in
            </button>
          )}
        </div>

        <p className="sos-auth-footer">
          Authorized BFP personnel only. Account activation is subject to administrator approval.
        </p>
      </section>
    </main>
  );
}

function ResetPasswordForm({ onComplete }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleReset(event) {
    event.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setSubmitting(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      await supabase.auth.signOut();
      onComplete();
    } catch (err) {
      setError(err.message || "Unable to update your password. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="sos-auth-page">
      <section className="sos-auth-card">
        <div className="sos-auth-icon">
          <img src="/images/FireNex Fire-Logo.png" alt="FireNex Logo" />
        </div>
        <p className="sos-auth-eyebrow">BUREAU OF FIRE PROTECTION</p>
        <h1>Reset password</h1>
        <p className="sos-auth-subtitle">Create a new password for your FireNex account.</p>

        <form onSubmit={handleReset}>
          <label htmlFor="sos-new-password">New password</label>
          <div className="sos-password-wrapper">
            <input
              id="sos-new-password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Enter new password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={6}
              required
            />
            <button
              className="sos-password-toggle"
              type="button"
              onClick={() => setShowPassword((previous) => !previous)}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>

          <label htmlFor="sos-confirm-password">Confirm new password</label>
          <input
            id="sos-confirm-password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Re-enter new password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            minLength={6}
            required
          />

          {error && (
            <p className="sos-auth-error" role="alert">
              {error}
            </p>
          )}

          <button className="sos-auth-button" type="submit" disabled={submitting}>
            {submitting ? "Updating..." : "Update password"}
          </button>
        </form>
      </section>
    </main>
  );
}

export default function AuthGate() {
  const [session, setSession] = useState(undefined);
  const [profile, setProfile] = useState(null);
  const [profileError, setProfileError] = useState("");
  const [checkingProfile, setCheckingProfile] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);

  useEffect(() => {
    let alive = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!alive) return;
      if (error) {
        console.error("Session check failed:", error.message);
        setSession(null);
        return;
      }
      setSession(data.session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!alive) return;
      if (event === "PASSWORD_RECOVERY") {
        setRecoveryMode(true);
      }
      setSession(newSession);
    });

    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let alive = true;

    async function loadProfile() {
      console.log("1. loadProfile started. Session:", session?.user?.id);

      if (!session?.user || recoveryMode) {
        console.log("2. No session or recovery mode. Stopping.");
        setProfile(null);
        setProfileError("");
        setCheckingProfile(false);
        return;
      }

      setCheckingProfile(true);
      setProfileError("");

      if (!navigator.onLine) {
        const cachedProfile = localStorage.getItem("firenex_profile");
        if (cachedProfile) {
          setProfile(JSON.parse(cachedProfile));
          setCheckingProfile(false);
          return;
        } else {
          setProfileError("You are offline and no cached profile was found. Please connect to the internet.");
          setCheckingProfile(false);
          return;
        }
      }

      setProfile(null);

      console.log("5. Fetching profile from Supabase...");
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, role, active")
        .eq("id", session.user.id)
        .maybeSingle();

      if (!alive) return;
      console.log("6. Supabase response:", { data, error });

      if (error) {
        console.log("7. Error fetching profile.");
        setProfileError("Unable to verify your account permissions. Please contact the administrator.");
      } else if (!data) {
        console.log("7. No data found.");
        setProfileError("No profile was found for your account. Please contact the administrator.");
      } else if (!data.active) {
        console.log("7. Account inactive.");
        setProfileError("Your account is inactive or awaiting administrator approval.");
      } else if (!["superadmin", "admin"].includes(data.role)) {
        console.log("7. Unauthorized role.");
        setProfileError("Your account does not have an authorized FireNex role.");
      } else {
        console.log("7. Success! Saving to localStorage.");
        localStorage.setItem("firenex_profile", JSON.stringify(data));

        if (data.role === "admin") {
          const { data: dutySession, error: dutyError } =
            await supabase.rpc("start_duty_session");
          console.log("9. Duty session response:", { dutySession, dutyError });
          if (dutyError) {
            console.error("10. Duty session failed, but continuing login.");
          }
        }

        if (!alive) return;
        console.log("11. Setting profile state.");
        setProfile(data);
      }

      setCheckingProfile(false);
      console.log("12. loadProfile finished.");
    }

    loadProfile();

    return () => {
      alive = false;
    };
  }, [session?.user?.id, recoveryMode]);

  async function handleSignOut() {
    try {
      if (navigator.onLine && profile?.role === "admin") {
        const { error } = await supabase.rpc("end_duty_session");
        if (error) throw error;
      }

      sessionStorage.removeItem("firenex_profile");
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
      return true;
    } catch (error) {
      console.error("Sign out failed:", error);
      window.alert(`Unable to sign out: ${error.message}`);
      return false;
    }
  }

  if (recoveryMode) {
    return <ResetPasswordForm onComplete={() => setRecoveryMode(false)} />;
  }

  if (session === undefined) {
    return <div className="sos-auth-loading">Loading FireNex...</div>;
  }

  if (!session) {
    return <LoginForm />;
  }

  if (checkingProfile) {
    return <div className="sos-auth-loading">Verifying account...</div>;
  }

  if (profileError || !profile) {
    return (
      <main className="sos-auth-page">
        <section className="sos-auth-card">
          <h1>Account verification</h1>
          <p className="sos-auth-error" role="alert">
            {profileError || "Your account could not be verified."}
          </p>
          <button className="sos-auth-button" onClick={handleSignOut}>
            Sign out
          </button>
        </section>
      </main>
    );
  }

  return <App profile={profile} onSignOut={handleSignOut} />;
}
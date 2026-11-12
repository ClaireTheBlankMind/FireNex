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
      if (!session?.user || recoveryMode) {
        setProfile(null);
        setProfileError("");
        setCheckingProfile(false);
        return;
      }

      setCheckingProfile(true);
      setProfileError("");

      // --- OFFLINE CHECK START ---
      if (!navigator.onLine) {
        console.log("App is offline. Loading cached profile.");
        const cachedProfile = localStorage.getItem("firenex_profile");
        
        if (cachedProfile) {
          setProfile(JSON.parse(cachedProfile));
          setCheckingProfile(false);
          return;
        } else {
          setProfileError("You are offline and no cached profile was found. Please connect to the internet to verify your account.");
          setCheckingProfile(false);
          return;
        }
      }
      // --- OFFLINE CHECK END ---

      setProfile(null);

      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, role, active")
        .eq("id", session.user.id)
        .maybeSingle();

      if (!alive) return;

      if (error) {
        console.error("Profile lookup failed:", error.message);
        setProfileError(
          "Unable to verify your account permissions. Please contact the administrator."
        );
      } else if (!data) {
        setProfileError(
          "No profile was found for your account. Please contact the administrator."
        );
      } else if (!data.active) {
        setProfileError(
          "Your account is inactive or awaiting administrator approval."
        );
      } else if (!["superadmin", "admin"].includes(data.role)) {
        setProfileError(
          "Your account does not have an authorized FireNex role."
        );
      } else {
        localStorage.setItem("firenex_profile", JSON.stringify(data));
        // -----------------------------------

        // Automatically start duty session for BFP personnel only.
        if (data.role === "admin") {
          const { data: dutySession, error: dutyError } =
            await supabase.rpc("start_duty_session");

          if (!alive) return;

          if (dutyError) {
            console.error("Failed to start duty session:", dutyError);
            
            // We log the error but DO NOT block the user from logging in.
            // This is important for offline resilience.
            // If you really want to block them, uncomment the lines below:
            // setProfileError("Unable to start your duty session...");
            // setCheckingProfile(false);
            // return;
          } else {
            console.log("BFP duty session active:", dutySession);
          }
        }

        if (!alive) return;

        setProfile(data);
      }

      setCheckingProfile(false);
    }

    loadProfile();

    return () => {
      alive = false;
    };
  }, [session?.user?.id, recoveryMode]);

  async function handleSignOut() {
    try {
      // End the duty session only for BFP personnel (admin).
      // Only do this if we are online.
      if (navigator.onLine && profile?.role === "admin") {
        const { data, error } = await supabase.rpc("end_duty_session");
        if (error) throw error;
      }

      // Clear the cached profile on logout
      localStorage.removeItem("firenex_profile");

      // Sign out from Supabase
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
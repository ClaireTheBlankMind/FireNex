import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase.js";
import {
  Menu,
  Bell,
  Search,
  X,
  Flame,
  RadioTower,
  Truck,
  CheckCheck,
  Trash2,
  ArrowRight,
  UserRound,
  ChevronDown,
  Settings,
  ShieldCheck,
  CircleHelp,
  LogOut,
} from "lucide-react";


const PAGE_HEADERS = {
  "Live Operations Map": {
    title: "Live Operations Map",
    subtitle: "Monitor fire incidents, IoT sensors, and emergency response units.",
  },
  "Fire Incidents": {
    title: "Fire Incident Reporting",
    subtitle: "Review reported emergencies and manage incident confirmation and dispatch.",
  },
  "IoT Monitoring": {
    title: "IoT Sensor Registration & Monitoring",
    subtitle: "Register sensors and monitor temperature, smoke levels, and sensor status.",
  },
  "Dispatch Units": {
    title: "Dispatch & Response Units",
    subtitle: "Manage BFP response teams, dispatch status, and unit assignments.",
  },
  "Incident History": {
    title: "Incident & Response Records",
    subtitle: "Review previous incidents, response activities, and resolution records.",
  },
  "Reports & Analytics": {
    title: "Reports & Analytics",
    subtitle: "Review emergency statistics and generate incident and response reports.",
  },
  "Search & Filter Records": {
    title: "Search & Filter Records",
    subtitle: "Find incidents, sensors, and response records using search and filters.",
  },
};


export default function Header({
  title,
  onMenuClick,
  sensors = [],
  incidents = [],
  units = [],
  onNavigate,
  onSignOut,
}) {
  
  const [searchText, setSearchText] = useState("");  
  const pageHeader = PAGE_HEADERS[title] || {
    title: title || "FireNex Dashboard",
    subtitle: "Fire Detection, Dispatch, and Emergency Response Monitoring System.",
  };
  
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [readIds, setReadIds] = useState([]);
  const [dismissedIds, setDismissedIds] = useState([]);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [accountSection, setAccountSection] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [signOutLoading, setSignOutLoading] = useState(false);

const accountMenuRef = useRef(null);

useEffect(() => {
  let mounted = true;

  async function loadUserProfile(user) {
    if (!mounted) return;

    setCurrentUser(user || null);

    if (!user) {
      setUserProfile(null);
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("full_name, role, active")
      .eq("id", user.id)
      .maybeSingle();

    if (!mounted) return;

    if (error) {
      console.error("Unable to load account profile:", error.message);
      setUserProfile(null);
      return;
    }

    setUserProfile(data);
  }

  supabase.auth.getSession().then(({ data, error }) => {
    if (error) {
      console.error("Unable to get session:", error.message);
      return;
    }

    const user = data.session?.user ?? null;

    console.log("Header authenticated user:", user);
    console.log("Header authenticated email:", user?.email);

    loadUserProfile(user);
  });

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    loadUserProfile(session?.user ?? null);
  });

  return () => {
    mounted = false;
    subscription.unsubscribe();
  };
}, []);

useEffect(() => {
  function handleOutsideClick(event) {
    if (
      accountMenuRef.current &&
      !accountMenuRef.current.contains(event.target)
    ) {
      setAccountMenuOpen(false);
      setAccountSection("");
    }
  }

  document.addEventListener("mousedown", handleOutsideClick);
  document.addEventListener("touchstart", handleOutsideClick);

  return () => {
    document.removeEventListener("mousedown", handleOutsideClick);
    document.removeEventListener("touchstart", handleOutsideClick);
  };
}, []);


async function handleSignOut() {
  if (signOutLoading) return;

  setSignOutLoading(true);

  try {
    if (typeof onSignOut !== "function") {
      throw new Error("Sign-out handler is not connected.");
    }

    const success = await onSignOut();

    // Keep the account menu open if logout was unsuccessful.
    if (success === false) return;

    setAccountMenuOpen(false);
    setAccountSection("");
  } catch (error) {
    console.error("Sign out failed:", error);
    window.alert(`Unable to sign out: ${error.message}`);
  } finally {
    setSignOutLoading(false);
  }
}

  // Search across incidents, sensors, and response units.
  const searchItems = useMemo(() => {
    const sensorItems = sensors.map((sensor) => ({
      id: `sensor-${sensor.id}`,
      title: sensor.id,
      description: `${sensor.barangay} · ${sensor.status}`,
      type: "IoT Sensor",
      icon: RadioTower,
      page: "IoT Monitoring",
      searchable: [
        sensor.id,
        sensor.barangay,
        sensor.status,
        sensor.temperature,
        sensor.smoke,
      ].join(" "),
    }));

    const incidentItems = incidents.map((incident) => ({
      id: `incident-${incident.id}`,
      title: incident.title || incident.id,
      description: `${incident.location || incident.barangay || "Location unavailable"} · ${incident.status}`,
      type: "Fire Incident",
      icon: Flame,
      page: "Fire Incidents",
      searchable: [
        incident.id,
        incident.title,
        incident.location,
        incident.barangay,
        incident.severity,
        incident.status,
        incident.source,
      ].join(" "),
    }));

    const unitItems = units.map((unit) => ({
      id: `unit-${unit.id}`,
      title: unit.id,
      description: `${unit.vehicle || "Response unit"} · ${unit.status}`,
      type: "Response Unit",
      icon: Truck,
      page: "Dispatch Units",
      searchable: [
        unit.id,
        unit.vehicle,
        unit.status,
      ].join(" "),
    }));

    return [...incidentItems, ...sensorItems, ...unitItems];
  }, [sensors, incidents, units]);

  const filteredResults = searchItems
    .filter((item) =>
      item.searchable
        .toLowerCase()
        .includes(searchText.trim().toLowerCase())
    )
    .slice(0, 8);

  // Create notifications from the current sample data.
  const allNotifications = useMemo(() => {
    const sensorAlerts = sensors
      .filter((sensor) => sensor.status !== "Normal")
      .map((sensor) => ({
        id: `sensor-alert-${sensor.id}`,
        title: "Sensor Alert",
        message: `${sensor.id} in ${sensor.barangay} reports ${sensor.status}. Temperature: ${sensor.temperature}°C.`,
        icon: RadioTower,
        page: "IoT Monitoring",
        level: "warning",
      }));

    const incidentAlerts = incidents
      .filter((incident) => incident.status !== "Resolved")
      .map((incident) => ({
        id: `incident-alert-${incident.id}`,
        title: "Unresolved Incident",
        message: `${incident.title || incident.id} · ${incident.location || incident.barangay || "Location unavailable"}. Status: ${incident.status}.`,
        icon: Flame,
        page: "Fire Incidents",
        level: "danger",
      }));

    const unitAlerts = units
      .filter((unit) =>
        ["Dispatched", "Responding", "On Scene"].includes(unit.status)
      )
      .map((unit) => ({
        id: `unit-alert-${unit.id}`,
        title: "Response Unit Update",
        message: `${unit.id} (${unit.vehicle || "Response unit"}) is ${unit.status}.`,
        icon: Truck,
        page: "Dispatch Units",
        level: "info",
      }));

    return [...sensorAlerts, ...incidentAlerts, ...unitAlerts];
  }, [sensors, incidents, units]);

  const notifications = allNotifications.filter(
    (notification) => !dismissedIds.includes(notification.id)
  );

  const unreadCount = notifications.filter(
    (notification) => !readIds.includes(notification.id)
  ).length;

  function openResult(item) {
    onNavigate?.(item.page);
    setSearchText("");
    setSearchOpen(false);
    setNotificationsOpen(false);
  }

  function openNotification(notification) {
    setReadIds((previous) =>
      previous.includes(notification.id)
        ? previous
        : [...previous, notification.id]
    );

    onNavigate?.(notification.page);
    setNotificationsOpen(false);
  }

  function markAllRead() {
    setReadIds((previous) => [
      ...new Set([
        ...previous,
        ...notifications.map((notification) => notification.id),
      ]),
    ]);
  }

  function clearNotifications() {
    setDismissedIds((previous) => [
      ...new Set([
        ...previous,
        ...notifications.map((notification) => notification.id),
      ]),
    ]);
    setNotificationsOpen(false);
  }

  return (
    <header className="topbar">


<div className="topbar-left">
  <button
    className="icon-button mobile-menu-button"
    onClick={onMenuClick}
    aria-label="Open navigation"
  >
    <Menu size={21} />
  </button>

  <div className="page-heading">
    <h1>{pageHeader.title}</h1>

  </div>
</div>



      <div className="topbar-actions">

        {/* Search */}
        <div className="header-popover-wrap">

          {searchOpen && (
            <div className="header-popover search-popover">
              <div className="popover-title">
                <div>
                  <strong>Search FireNex</strong>
                  <p>Find incidents, sensors, or response units.</p>
                </div>
              </div>

              <div className="search-input-wrap">
                <Search size={17} />
                <input
                  autoFocus
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder="Search ID, barangay, status..."
                  aria-label="Search incidents, sensors, and units"
                />
                {searchText && (
                  <button
                    className="popover-clear-button"
                    onClick={() => setSearchText("")}
                    aria-label="Clear search"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              <div className="search-results">
                {!searchText.trim() ? (
                  <div className="popover-empty">
                    <Search size={22} />
                    <span>Enter a keyword to search records.</span>
                  </div>
                ) : filteredResults.length === 0 ? (
                  <div className="popover-empty">
                    No matching records found.
                  </div>
                ) : (
                  filteredResults.map((item) => {
                    const ItemIcon = item.icon;

                    return (
                      <button
                        className="search-result"
                        key={item.id}
                        onClick={() => openResult(item)}
                      >
                        <span className="result-icon">
                          <ItemIcon size={18} />
                        </span>

                        <span className="result-text">
                          <strong>{item.title}</strong>
                          <small>{item.description}</small>
                          <span className="result-type">{item.type}</span>
                        </span>

                        <ArrowRight size={16} />
                      </button>
                    );
                  })
                )}
              </div>

              <div className="popover-footer">
                Searching sample data only
              </div>
            </div>
          )}
        </div>

        {/* Notifications */}
        <div className="header-popover-wrap">
          <button
            className={`icon-button notification-button ${
              notificationsOpen ? "active" : ""
            }`}
            title="Notifications"
            aria-label={`Notifications, ${unreadCount} unread`}
            aria-expanded={notificationsOpen}
            onClick={() => {
              setNotificationsOpen((open) => !open);
              setSearchOpen(false);
            }}
          >
            <Bell size={19} />
            {unreadCount > 0 && (
              <span className="notification-count">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>

          {notificationsOpen && (
            <div className="header-popover notification-popover">
              <div className="notification-heading">
                <div>
                  <strong>Notifications</strong>
                  <p>
                    {unreadCount} unread · {notifications.length} total
                  </p>
                </div>

                <button
                  className="popover-icon-action"
                  title="Mark all as read"
                  aria-label="Mark all notifications as read"
                  onClick={markAllRead}
                >
                  <CheckCheck size={17} />
                </button>
              </div>

              <div className="notification-list">
                {notifications.length === 0 ? (
                  <div className="popover-empty">
                    <Bell size={22} />
                    <span>No notifications to display.</span>
                  </div>
                ) : (
                  notifications.map((notification) => {
                    const NotificationIcon = notification.icon;
                    const isRead = readIds.includes(notification.id);

                    return (
                      <button
                        className={`notification-item ${
                          isRead ? "is-read" : "is-unread"
                        }`}
                        key={notification.id}
                        onClick={() => openNotification(notification)}
                      >
                        <span
                          className={`notification-icon ${notification.level}`}
                        >
                          <NotificationIcon size={18} />
                        </span>

                        <span className="notification-copy">
                          <strong>{notification.title}</strong>
                          <small>{notification.message}</small>
                          <span className="notification-action">
                            View details <ArrowRight size={13} />
                          </span>
                        </span>

                        {!isRead && (
                          <span className="unread-indicator" />
                        )}
                      </button>
                    );
                  })
                )}
              </div>

              <div className="notification-footer">
                <button onClick={markAllRead}>
                  <CheckCheck size={15} />
                  Mark all read
                </button>

                <button onClick={clearNotifications}>
                  <Trash2 size={15} />
                  Clear all
                </button>
              </div>
            </div>
          )}
        </div>

<div className="account-menu-wrap" ref={accountMenuRef}>
  <button
    type="button"
    className={`account-trigger ${accountMenuOpen ? "active" : ""}`}
    title="Account menu"
    aria-label="Open account menu"
    aria-expanded={accountMenuOpen}
    onClick={() => {
      setAccountMenuOpen((open) => !open);
      setAccountSection("");
      setNotificationsOpen(false);
      setSearchOpen(false);
    }}
  >
    <span className="user-avatar">
      {(userProfile?.full_name || currentUser?.email || "B")
        .trim()
        .charAt(0)
        .toUpperCase()}
    </span>

  <span>
    {userProfile?.full_name || "Account"}
  </span>

    <ChevronDown size={16} />
  </button>

  {accountMenuOpen && (
    <div className="account-dropdown">
      {!accountSection ? (
        <>
          <div className="account-dropdown-heading">
            <span className="user-avatar account-large-avatar">
              {(userProfile?.full_name || currentUser?.email || "B")
                .trim()
                .charAt(0)
                .toUpperCase()}
            </span>

            <div>
              <strong>
                {userProfile?.full_name || "Account"}
              </strong>
              <small>{currentUser?.email || "Email unavailable"}</small>
            </div>
          </div>

          <div className="account-dropdown-divider" />

          <button
            type="button"
            className="account-dropdown-item"
            onClick={() => {
                setAccountMenuOpen(false);
                setAccountSection("");
                onNavigate("My Profile");
              }}
          >
            <UserRound size={18} />
            <span>My Profile</span>
            <ArrowRight size={15} />
          </button>

          <button
            type="button"
            className="account-dropdown-item"
            onClick={() => {
                setAccountMenuOpen(false);
                setAccountSection("");
                onNavigate("Account Settings");
              }}
          >
            <Settings size={18} />
            <span>Account Settings</span>
            <ArrowRight size={15} />
          </button>

          <button
            type="button"
            className="account-dropdown-item"
            onClick={() => {
              setAccountMenuOpen(false);
              setAccountSection("");
              onNavigate("Security");
            }}  
          >
            <ShieldCheck size={18} />
            <span>Security</span>
            <ArrowRight size={15} />
          </button>

          <button
            type="button"
            className="account-dropdown-item"
            onClick={() => {
              setAccountMenuOpen(false);
              setAccountSection("");
              onNavigate("Help & Support");
            }}         
             >
            <CircleHelp size={18} />
            <span>Help & Support</span>
            <ArrowRight size={15} />
          </button>

          <div className="account-dropdown-divider" />

          <button
            type="button"
            className="account-dropdown-item account-signout"
            onClick={handleSignOut}
            disabled={signOutLoading}
          >
            <LogOut size={18} />
            <span>{signOutLoading ? "Signing out..." : "Sign Out"}</span>
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            className="account-back-button"
            onClick={() => setAccountSection("")}
          >
            <ArrowRight
              size={15}
              style={{ transform: "rotate(180deg)" }}
            />
            Back to account menu
          </button>

          {accountSection === "profile" && (
            <div className="account-detail-panel">
              <UserRound size={25} />
              <h3>My Profile</h3>

              <label>Full Name</label>
              <p>{userProfile?.full_name || "Not set"}</p>

              <label>Email Address</label>
              <p>{currentUser?.email || "Unavailable"}</p>

              <p>
                {userProfile?.active === true
                  ? "Active"
                  : userProfile?.active === false
                    ? "Inactive"
                    : "Unavailable"}
              </p>
            </div>
          )}

          {accountSection === "settings" && (
            <div className="account-detail-panel">
              <Settings size={25} />
              <h3>Account Settings</h3>
              <p>
                Account preferences can be added here in a future update.
              </p>
            </div>
          )}

          {accountSection === "security" && (
            <div className="account-detail-panel">
              <ShieldCheck size={25} />
              <h3>Security</h3>
              <p>
                Your account uses Supabase authentication. Password
                management can be connected here next.
              </p>
            </div>
          )}

          {accountSection === "help" && (
            <div className="account-detail-panel">
              <CircleHelp size={25} />
              <h3>Help & Support</h3>
              <p>
                For system assistance, contact your FireNex system
                administrator.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )}
</div>
      </div>
    </header>
  );
}

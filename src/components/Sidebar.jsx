import {
  Map,
  RadioTower,
  Flame,
  Truck,
  History,
  ChartNoAxesCombined,
  ShieldAlert,
  PanelLeftClose,
  ScrollText,
  UsersRound,
} from "lucide-react";

import { useState } from "react";

const navigation = [
  { label: "Live Operations Map", icon: Map },
  { label: "IoT Monitoring", icon: RadioTower },
  { label: "Fire Incidents", icon: Flame },
  { label: "Dispatch Units", icon: Truck },
  { label: "Incident History", icon: History },
  { label: "Reports & Analytics", icon: ChartNoAxesCombined },
  { label: "System Log", icon: ScrollText },
  { label: "Admin Account Control & Approval", icon: UsersRound },
];

export default function Sidebar({
  profile,
  activePage,
  setActivePage,
  mobileOpen,
  setMobileOpen,
}) {
  const [hovered, setHovered] = useState(false);

  const isSuperadmin =
  profile?.role === "superadmin" &&
  profile?.active === true;

  const visibleNavigation = navigation.filter((item) => {
    if (
      item.label === "System Log" ||
      item.label === "Admin Account Control & Approval"
    ) {
      return isSuperadmin;
    }

    return true;
  });

  return (
    <>
      {mobileOpen && (
        <button
          className="mobile-overlay"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`sidebar ${
          mobileOpen ? "sidebar-open" : ""
        } ${hovered ? "sidebar-expanded" : "sidebar-collapsed"}`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div className="brand">
          <div className="brand-icon">
            <img
              src="/images/firenex-sidebar-logo.png"
              alt="FireNex"
            />
          </div>

          <button
            className="sidebar-close"
            onClick={() => setMobileOpen(false)}
            aria-label="Close sidebar"
          >
            <PanelLeftClose size={19} />
          </button>
        </div>

        <div className="nav-caption">OPERATIONS</div>

        <nav className="navigation">
          {visibleNavigation.map(({ label, icon: Icon }) => (
            <button
              key={label}
              title={!hovered ? label : undefined}
              className={`nav-item ${
                activePage === label ? "active" : ""
              }`}
              onClick={() => {
                setActivePage(label);
                setMobileOpen(false);
              }}
            >
              <Icon size={19} strokeWidth={1.9} />

              <span className="nav-label">{label}</span>

              {label === "Fire Incidents" && (
                <span className="nav-indicator" />
              )}
            </button>
          ))}
        </nav>
      </aside>
    </>
  );
}

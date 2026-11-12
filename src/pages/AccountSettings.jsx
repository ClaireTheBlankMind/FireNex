
import { useEffect, useState } from "react";
import {
  Settings,
  BellRing,
  Volume2,
  Monitor,
  Map,
  Save,
  RotateCcw,
  CircleCheck,
  Info,
} from "lucide-react";
import AccountPageLayout from "../components/AccountPageLayout";

const STORAGE_KEY = "sosalert_account_settings";

const DEFAULT_SETTINGS = {
  incidentNotifications: true,
  criticalAlerts: true,
  notificationSound: true,
  autoRefresh: false,
  compactDashboard: false,
};

function loadSettings() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    return saved
      ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) }
      : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export default function AccountSettings({ onBack }) {
  const [settings, setSettings] = useState(loadSettings);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!saved) return;

    const timeout = window.setTimeout(() => setSaved(false), 3000);
    return () => window.clearTimeout(timeout);
  }, [saved]);

  function updateSetting(key, value) {
    setSettings((current) => ({ ...current, [key]: value }));
    setSaved(false);
    setError("");
  }

  function saveSettings(event) {
    event.preventDefault();

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      setSaved(true);
      setError("");
    } catch {
      setError("Unable to save preferences in this browser.");
      setSaved(false);
    }
  }

  function resetSettings() {
    setSettings({ ...DEFAULT_SETTINGS });
    setSaved(false);
    setError("");
  }

  const groups = [
    {
      title: "Incident Notifications",
      description: "Choose which incident alerts you want to receive.",
      icon: BellRing,
      items: [
        {
          key: "incidentNotifications",
          label: "Incident notifications",
          detail: "Enable notification preferences for reported fire incidents.",
        },
        {
          key: "criticalAlerts",
          label: "Critical incident alerts",
          detail: "Enable preferences for high-priority fire emergencies.",
        },
      ],
    },
    {
      title: "Sound Preferences",
      description: "Configure your preferred notification sound behavior.",
      icon: Volume2,
      items: [
        {
          key: "notificationSound",
          label: "Notification sound",
          detail: "Allow the application to use sound for supported alerts.",
        },
      ],
    },
    {
      title: "Dashboard Display",
      description: "Adjust how the monitoring dashboard is displayed.",
      icon: Monitor,
      items: [
        {
          key: "autoRefresh",
          label: "Automatic refresh preference",
          detail: "Save your preference for automatic dashboard refresh.",
        },
        {
          key: "compactDashboard",
          label: "Compact dashboard preference",
          detail: "Save your preference for a more compact dashboard layout.",
        },
      ],
    },
  ];

  return (
    <AccountPageLayout
      title="Account Settings"
      description="Customize your FireNex experience and notification preferences."
      icon={Settings}
      onBack={onBack}
    >
      <form className="settings-page-grid" onSubmit={saveSettings}>
        <div className="settings-main-column">
          {groups.map((group) => {
            const Icon = group.icon;

            return (
              <section className="account-card" key={group.title}>
                <div className="settings-group-heading">
                  <div className="settings-row-icon">
                    <Icon size={21} />
                  </div>
                  <div>
                    <h2>{group.title}</h2>
                    <p>{group.description}</p>
                  </div>
                </div>

                {group.items.map((item) => (
                  <div className="settings-toggle-row" key={item.key}>
                    <div className="settings-toggle-copy">
                      <strong>{item.label}</strong>
                      <p>{item.detail}</p>
                    </div>

                    <label className="account-switch">
                      <input
                        type="checkbox"
                        checked={settings[item.key]}
                        onChange={(event) =>
                          updateSetting(item.key, event.target.checked)
                        }
                      />
                      <span className="account-switch-track" />
                    </label>
                  </div>
                ))}
              </section>
            );
          })}

          <div className="account-form-actions">
            <button
              type="button"
              className="account-secondary-button"
              onClick={resetSettings}
            >
              <RotateCcw size={17} />
              Restore Defaults
            </button>

            <button type="submit" className="account-primary-button">
              <Save size={17} />
              Save Preferences
            </button>
          </div>

          {saved && (
            <div className="account-alert account-alert-success">
              <CircleCheck size={19} />
              Your preferences have been saved on this device.
            </div>
          )}

          {error && (
            <div className="account-alert account-alert-error">{error}</div>
          )}
        </div>

        <aside className="account-card settings-summary">
          <div className="settings-summary-icon">
            <Map size={24} />
          </div>
          <h2>Monitoring Preferences</h2>
          <p>
            These options store your preferences. They do not independently
            connect IoT devices, activate dispatches, or guarantee delivery of
            emergency notifications.
          </p>

          <div className="settings-summary-row">
            <span>Incident notifications</span>
            <strong>
              {settings.incidentNotifications ? "Enabled" : "Disabled"}
            </strong>
          </div>

          <div className="settings-summary-row">
            <span>Critical alerts preference</span>
            <strong>{settings.criticalAlerts ? "Enabled" : "Disabled"}</strong>
          </div>

          <div className="settings-summary-row">
            <span>Sound preference</span>
            <strong>{settings.notificationSound ? "On" : "Off"}</strong>
          </div>

          <div className="settings-info">
            <Info size={18} />
            <span>
              Emergency alert handling should remain operational according to
              authorized system rules, regardless of personal preferences.
            </span>
          </div>
        </aside>
      </form>
    </AccountPageLayout>
  );
}

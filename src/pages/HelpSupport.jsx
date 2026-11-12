
import { useMemo, useState } from "react";
import {
  CircleHelp,
  Search,
  ChevronDown,
  Map,
  RadioTower,
  Flame,
  Truck,
  FileText,
  ShieldCheck,
  WifiOff,
  Mail,
  BookOpen,
  LifeBuoy,
  AlertTriangle,
} from "lucide-react";
import AccountPageLayout from "../components/AccountPageLayout";

const helpCategories = [
  { id: "all", label: "All Topics" },
  { id: "dashboard", label: "Dashboard" },
  { id: "incidents", label: "Fire Incidents" },
  { id: "sensors", label: "IoT Sensors" },
  { id: "dispatch", label: "Dispatch & Units" },
  { id: "account", label: "Account & Security" },
];

const faqs = [
  {
    id: 1,
    category: "dashboard",
    question: "What does the Live Operations Map show?",
    answer:
      "The map is intended to display reported fire incidents, registered IoT sensor locations, and available response-unit positions. The accuracy and freshness of each item depend on the data source connected to your system.",
    icon: Map,
  },
  {
    id: 2,
    category: "incidents",
    question: "How should personnel handle a newly reported fire incident?",
    answer:
      "Review the incident location, timestamp, sensor information, and available details. Follow your station's emergency response procedures and verify information as required before confirming dispatch. Do not treat an unverified sensor alert as proof that a fire is present.",
    icon: Flame,
  },
  {
    id: 3,
    category: "sensors",
    question: "Why is an IoT sensor showing offline?",
    answer:
      "Check the sensor's power supply, network connection, device identifier, and most recent heartbeat. Confirm that the device is configured to send telemetry to the correct backend. An offline status means current readings may be unavailable; it does not establish that the area is safe.",
    icon: WifiOff,
  },
  {
    id: 4,
    category: "sensors",
    question: "Why are smoke or temperature readings missing?",
    answer:
      "Verify the sensor wiring and power, confirm that the hardware is transmitting the expected fields, and inspect the backend logs for rejected requests or connection errors. Check that the device identifier matches a registered sensor. Actual hardware telemetry must be integrated before readings can be considered live.",
    icon: RadioTower,
  },
  {
    id: 5,
    category: "dispatch",
    question: "How do I confirm a dispatch?",
    answer:
      "Open Dispatch & Units, review the associated incident and available unit, then follow your authorized station workflow. Only confirm dispatch when an authorized operator has made the decision and the relevant information has been verified. The button should be connected to a persistent backend before being used operationally.",
    icon: Truck,
  },
  {
    id: 6,
    category: "incidents",
    question: "Where can I find previous incidents?",
    answer:
      "Open Incident History to review previously recorded incidents. Use Reports & Analytics to view available summaries. The completeness of historical records depends on whether incidents are being saved to your persistent database.",
    icon: FileText,
  },
  {
    id: 7,
    category: "account",
    question: "Why can I not access an administrator feature?",
    answer:
      "Your account may not have the required role or active status. Ask an authorized administrator to check your profile. Permissions must also be enforced in Supabase policies and backend operations; hiding a menu item alone is not sufficient security.",
    icon: ShieldCheck,
  },
  {
    id: 8,
    category: "account",
    question: "How can I reset my password?",
    answer:
      "Open Security and request a password reset link. Check the inbox and spam folder for the account email. If no message arrives, ask the system administrator to check Supabase email settings and redirect URL configuration.",
    icon: ShieldCheck,
  },
  {
    id: 9,
    category: "dashboard",
    question: "Why does the map not show the latest positions?",
    answer:
      "Check the internet connection, map data source, telemetry timestamps, and backend subscription or refresh logic. A map can render correctly even when its data is static, so verify that the underlying records are being updated.",
    icon: Map,
  },
];

export default function HelpSupport({ onBack }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [expanded, setExpanded] = useState(1);
  const [showContact, setShowContact] = useState(false);
  const [supportSubject, setSupportSubject] = useState("");
  const [supportDetails, setSupportDetails] = useState("");
  const [supportMessage, setSupportMessage] = useState("");

  const filteredFaqs = useMemo(() => {
    const term = search.trim().toLowerCase();

    return faqs.filter((faq) => {
      const matchesCategory =
        category === "all" || faq.category === category;

      const matchesSearch =
        !term ||
        faq.question.toLowerCase().includes(term) ||
        faq.answer.toLowerCase().includes(term);

      return matchesCategory && matchesSearch;
    });
  }, [search, category]);

  function submitSupportRequest(event) {
    event.preventDefault();

    if (supportSubject.trim().length < 3) {
      setSupportMessage("Please enter a subject of at least 3 characters.");
      return;
    }

    if (supportDetails.trim().length < 10) {
      setSupportMessage("Please provide at least 10 characters of detail.");
      return;
    }

    // No support-ticket backend or administrator email is assumed.
    // This confirms only that the form was validated, not that a ticket was sent.
    setSupportMessage(
      "Your form is valid, but no support ticket has been sent. Connect this form to an approved support email or backend to submit requests."
    );
  }

  return (
    <AccountPageLayout
      title="Help & Support"
      description="Find instructions and troubleshooting guidance for the FireNex BFP system."
      icon={CircleHelp}
      onBack={onBack}
    >
      <section className="help-welcome">
        <div className="help-welcome-icon">
          <BookOpen size={30} />
        </div>
        <div>
          <span className="account-eyebrow">SOSALERT USER GUIDE</span>
          <h2>How can we help you?</h2>
          <p>
            Search for guidance on monitoring incidents, sensor status,
            dispatch workflows, and account access.
          </p>
        </div>
      </section>

      <section className="account-card help-search-card">
        <label className="help-search-box">
          <Search size={20} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search questions, sensors, dispatch, accounts..."
            aria-label="Search help articles"
          />
        </label>

        <div className="help-category-list">
          {helpCategories.map((item) => (
            <button
              key={item.id}
              type="button"
              className={
                category === item.id
                  ? "help-category-button active"
                  : "help-category-button"
              }
              onClick={() => setCategory(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      <div className="help-content-grid">
        <section className="account-card">
          <div className="account-section-heading">
            <div>
              <h2>Frequently Asked Questions</h2>
              <p>
                {filteredFaqs.length} article
                {filteredFaqs.length === 1 ? "" : "s"} found
              </p>
            </div>
          </div>

          {filteredFaqs.length === 0 ? (
            <div className="help-empty-state">
              <Search size={27} />
              <h3>No matching help articles</h3>
              <p>Try another keyword or choose a different topic.</p>
              <button
                type="button"
                className="account-secondary-button"
                onClick={() => {
                  setSearch("");
                  setCategory("all");
                }}
              >
                Clear Filters
              </button>
            </div>
          ) : (
            <div className="help-faq-list">
              {filteredFaqs.map((faq) => {
                const Icon = faq.icon;
                const isOpen = expanded === faq.id;

                return (
                  <article className="help-faq-item" key={faq.id}>
                    <button
                      type="button"
                      className="help-faq-question"
                      aria-expanded={isOpen}
                      onClick={() =>
                        setExpanded(isOpen ? null : faq.id)
                      }
                    >
                      <span className="help-faq-icon">
                        <Icon size={19} />
                      </span>
                      <span>{faq.question}</span>
                      <ChevronDown
                        size={19}
                        className={isOpen ? "faq-chevron open" : "faq-chevron"}
                      />
                    </button>

                    {isOpen && (
                      <div className="help-faq-answer">
                        <p>{faq.answer}</p>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <aside className="help-side-column">
          <section className="account-card help-quick-card">
            <div className="settings-row-icon">
              <LifeBuoy size={22} />
            </div>
            <h2>System Support</h2>
            <p>
              For access issues, incorrect account roles, or system
              configuration problems, contact your authorized FireNex
              administrator through your official station channel.
            </p>
            <button
              type="button"
              className="account-primary-button"
              onClick={() => setShowContact((value) => !value)}
            >
              <Mail size={17} />
              {showContact ? "Hide Support Form" : "Prepare Support Request"}
            </button>
          </section>

          <section className="account-card help-warning-card">
            <AlertTriangle size={22} />
            <div>
              <h3>Emergency Reminder</h3>
              <p>
                This help center is not an emergency reporting channel.
                Follow official BFP procedures for actual fire emergencies.
              </p>
            </div>
          </section>
        </aside>
      </div>

      {showContact && (
        <section className="account-card help-contact-form">
          <h2>Prepare a Support Request</h2>
          <p className="account-muted">
            Describe the issue so an authorized administrator can review it.
            This form does not transmit a request until a backend or approved
            support channel is connected.
          </p>

          <form onSubmit={submitSupportRequest}>
            <label className="account-field">
              <span>Issue Subject</span>
              <input
                value={supportSubject}
                onChange={(event) => setSupportSubject(event.target.value)}
                placeholder="Example: Unable to view sensor readings"
                maxLength={120}
                required
              />
            </label>

            <label className="account-field">
              <span>Issue Details</span>
              <textarea
                value={supportDetails}
                onChange={(event) => setSupportDetails(event.target.value)}
                placeholder="Describe what happened and which page is affected."
                rows={5}
                maxLength={2000}
                required
              />
            </label>

            <button type="submit" className="account-primary-button">
              Validate Support Request
            </button>

            {supportMessage && (
              <div className="account-alert account-alert-info">
                {supportMessage}
              </div>
            )}
          </form>
        </section>
      )}
    </AccountPageLayout>
  );
}

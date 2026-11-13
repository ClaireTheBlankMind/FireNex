
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ScrollText,
  RefreshCw,
  ShieldCheck,
  Search,
  Activity,
  Clock3,
  UserRound,
  FileSearch,
  CalendarDays,
  CheckCircle2,
  AlertTriangle,
  LogIn,
  LogOut,
} from "lucide-react";

import { supabase } from "../lib/supabase.js";
import "./AdminPages.css";

const LOG_BATCH_SIZE = 1000;

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function formatTime(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

function formatDetails(details) {
  if (!details || typeof details !== "object") {
    return details == null
      ? "No additional details"
      : String(details);
  }

  if (Object.keys(details).length === 0) {
    return "No additional details";
  }

  return JSON.stringify(details, null, 2);
}

function getActivityDescription(log) {
  const details = log.details || {};
  const action = (log.action || "").replaceAll("_", " ").toUpperCase();
  const entity = (log.entity_type || "system").replaceAll("_", " ");

  const description =
    details.activity ||
    details.description ||
    details.message ||
    details.performed ||
    details.summary;

  if (description) return description;

  if (action === "LOGIN") return "Logged in to FireNex";
  if (action === "LOGOUT") return "Logged out of FireNex";
  if (action === "UPDATE") return `Updated ${entity}`;
  if (action === "DELETE") return `Deleted ${entity}`;
  if (action === "APPROVE") return `Approved ${entity}`;
  if (action === "DEACTIVATE") return `Deactivated ${entity}`;

  return `${action || "Performed an action"} ${entity}`;
}

function getActionClass(action = "") {
  const value = action.toLowerCase();

  if (
    value.includes("deactivat") ||
    value.includes("delet") ||
    value.includes("denied") ||
    value.includes("failed")
  ) {
    return "action-danger";
  }

  if (
    value.includes("approv") ||
    value.includes("activat") ||
    value.includes("success")
  ) {
    return "action-success";
  }

  if (
    value.includes("warning") ||
    value.includes("suspend")
  ) {
    return "action-warning";
  }

  return "";
}

function getActionIcon(action = "") {
  const value = action.toLowerCase();

  if (value.includes("login")) return LogIn;
  if (value.includes("logout")) return LogOut;

  if (
    value.includes("approv") ||
    value.includes("activat")
  ) {
    return CheckCircle2;
  }

  if (
    value.includes("deactivat") ||
    value.includes("failed")
  ) {
    return AlertTriangle;
  }

  return Activity;
}

export default function SystemLog() {
  const [logs, setLogs] = useState([]);
  const [actorProfiles, setActorProfiles] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [authorized, setAuthorized] = useState(false);

  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");

  // Load ALL system logs from Supabase in batches.
  const loadLogs = useCallback(async (isRefresh = false) => {
    setError("");

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (!user) {
        setAuthorized(false);
        setLogs([]);
        setActorProfiles({});
        setError("Please sign in to access the system log.");
        return;
      }

      // Verify active Superadmin access.
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, active")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      if (
        !profile ||
        profile.active !== true ||
        profile.role !== "superadmin"
      ) {
        setAuthorized(false);
        setLogs([]);
        setActorProfiles({});
        setError(
          "Only an active Superadmin can access the system log."
        );
        return;
      }

      setAuthorized(true);

      // Retrieve every available record, regardless of total count.
      let allLogs = [];
      let from = 0;

      while (true) {
        const to = from + LOG_BATCH_SIZE - 1;

        const { data, error: logsError } = await supabase
          .from("system_logs")
          .select(
            "id, actor_id, action, entity_type, entity_id, details, created_at"
          )
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .range(from, to);

        if (logsError) throw logsError;

        const batch = data ?? [];

        allLogs = allLogs.concat(batch);

        if (batch.length < LOG_BATCH_SIZE) {
          break;
        }

        from += LOG_BATCH_SIZE;
      }

    const actorIds = [
      ...new Set(
        allLogs
          .map((log) => log.actor_id)
          .filter(Boolean)
      ),
    ];

    const profileMap = {};

    // Fetch profiles in batches to avoid oversized requests.
    for (let i = 0; i < actorIds.length; i += 500) {
      const actorBatch = actorIds.slice(i, i + 500);

      const {
        data: actorData,
        error: actorError,
      } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .in("id", actorBatch);

      if (actorError) {
        console.error(
          "Could not retrieve some log actor profiles:",
          actorError
        );
        continue;
      }

      (actorData || []).forEach((actor) => {
        profileMap[actor.id] = actor;
      });
    }

    setActorProfiles(profileMap);
    setLogs(allLogs);

    } catch (err) {
      console.error("Failed to load system logs:", err);
      setError(err.message || "Failed to load system logs.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  // Available action filters.
  const actionOptions = useMemo(() => {
    return [...new Set(
      logs.map((log) => log.action).filter(Boolean)
    )].sort((a, b) => a.localeCompare(b));
  }, [logs]);

  // Search and filter ALL loaded logs.
  const filteredLogs = useMemo(() => {
    const query = search.trim().toLowerCase();
    const now = new Date();

    return logs.filter((log) => {
    const actor = actorProfiles[log.actor_id];

    const searchable = [
      log.action,
      log.entity_type,
      log.entity_id,
      log.actor_id,
      log.details?.email,
      log.details?.full_name,
      actor?.email,
      actor?.full_name,
      formatDetails(log.details),
    ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !query || searchable.includes(query);

      const matchesAction =
        actionFilter === "all" ||
        log.action === actionFilter;

      let matchesDate = true;

      if (dateFilter !== "all" && log.created_at) {
        const logDate = new Date(log.created_at);

        if (Number.isNaN(logDate.getTime())) {
          matchesDate = false;
        } else if (dateFilter === "today") {
          matchesDate =
            logDate.getFullYear() === now.getFullYear() &&
            logDate.getMonth() === now.getMonth() &&
            logDate.getDate() === now.getDate();
        } else if (
          dateFilter === "7days" ||
          dateFilter === "30days"
        ) {
          const cutoff = new Date(now);

          cutoff.setDate(
            cutoff.getDate() -
              (dateFilter === "7days" ? 7 : 30)
          );

          matchesDate =
            logDate >= cutoff && logDate <= now;
        }
      }

      return matchesSearch && matchesAction && matchesDate;
    });
  }, [logs, actorProfiles, search, actionFilter, dateFilter]);

  // Today's log count.
  const todayCount = useMemo(() => {
    const now = new Date();

    return logs.filter((log) => {
      if (!log.created_at) return false;

      const date = new Date(log.created_at);

      return (
        !Number.isNaN(date.getTime()) &&
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate()
      );
    }).length;
  }, [logs]);

  // Account-related activities.
  const accountCount = useMemo(
    () =>
      logs.filter((log) =>
        /account|profile|login|logout|duty/i.test(
          log.action || ""
        )
      ).length,
    [logs]
  );

  // Incident and dispatch activities.
  const recordCount = useMemo(
    () =>
      logs.filter((log) =>
        /incident|dispatch/i.test(
          `${log.action || ""} ${log.entity_type || ""}`
        )
      ).length,
    [logs]
  );

  if (loading) {
    return (
      <section className="system-log-page">
        <div className="system-log-state">
          <RefreshCw size={28} className="admin-spin" />

          <strong>Loading system audit log</strong>

          <p>
            Verifying permissions and retrieving all available activity.
          </p>
        </div>
      </section>
    );
  }

  if (!authorized) {
    return (
      <section className="system-log-page">
        <div className="system-log-restricted">
          <ShieldCheck size={40} />

          <h2>System Log Access Restricted</h2>

          <p role="alert">
            {error ||
              "Only an active Superadmin can access this page."}
          </p>

          <button
            type="button"
            className="admin-button admin-button-primary"
            onClick={() => loadLogs(true)}
            disabled={refreshing}
          >
            <RefreshCw
              size={16}
              className={refreshing ? "admin-spin" : ""}
            />

            {refreshing ? "Checking..." : "Check access again"}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="system-log-page">

      {/* Top toolbar */}
      <div className="system-log-toolbar-top">
        <div className="system-log-view-switch">
          <button
            type="button"
            className="admin-button admin-button-primary"
            disabled
          >
            <ScrollText size={15} />
            All System Logs
          </button>
        </div>

        <button
          type="button"
          className="admin-button admin-button-secondary"
          onClick={() => loadLogs(true)}
          disabled={refreshing}
        >
          <RefreshCw
            size={15}
            className={refreshing ? "admin-spin" : ""}
          />

          {refreshing ? "Refreshing..." : "Refresh logs"}
        </button>
      </div>

      {/* Statistics */}
      <div className="system-log-stats">
        <article className="system-log-stat-card">
          <div className="system-log-stat-icon">
            <Activity size={21} />
          </div>

          <div>
            <strong>{logs.length.toLocaleString()}</strong>
            <span>Total log entries</span>
          </div>
        </article>

        <article
          className="system-log-stat-card"
          style={{
            "--log-color": "#168453",
            "--log-tint": "#e5f8ed",
          }}
        >
          <div className="system-log-stat-icon">
            <Clock3 size={21} />
          </div>

          <div>
            <strong>{todayCount.toLocaleString()}</strong>
            <span>Entries recorded today</span>
          </div>
        </article>

        <article
          className="system-log-stat-card"
          style={{
            "--log-color": "#b66a0b",
            "--log-tint": "#fff2dc",
          }}
        >
          <div className="system-log-stat-icon">
            <UserRound size={21} />
          </div>

          <div>
            <strong>
              {(accountCount + recordCount).toLocaleString()}
            </strong>
            <span>Account and record activity matches</span>
          </div>
        </article>
      </div>

      {/* Activity history */}
      <div className="system-log-panel">
        <div className="system-log-panel-heading">
          <div>
            <h2>Activity history</h2>

            <p>
              Search and filter all recorded audit entries.
            </p>
          </div>

          <span className="admin-count-badge">
            {filteredLogs.length.toLocaleString()} results
          </span>
        </div>

        {/* Search and filters */}
        <div className="system-log-toolbar">
          <label className="system-log-search">
            <Search size={17} />

            <input
              type="search"
              placeholder="Search actions, record IDs, actor IDs..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search system logs"
            />
          </label>

          <div className="system-log-filters">
            <label>
              <span className="sr-only">Filter by action</span>

              <select
                value={actionFilter}
                onChange={(event) =>
                  setActionFilter(event.target.value)
                }
                aria-label="Filter logs by action"
              >
                <option value="all">All actions</option>

                {actionOptions.map((action) => (
                  <option key={action} value={action}>
                    {action.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="sr-only">Filter by date</span>

              <select
                value={dateFilter}
                onChange={(event) =>
                  setDateFilter(event.target.value)
                }
                aria-label="Filter logs by date"
              >
                <option value="all">Any date</option>
                <option value="today">Today</option>
                <option value="7days">Last 7 days</option>
                <option value="30days">Last 30 days</option>
              </select>
            </label>
          </div>
        </div>

        {error && (
          <p role="alert" className="system-log-error">
            {error}
          </p>
        )}

        {/* Empty state or logs table */}
        {filteredLogs.length === 0 ? (
          <div className="system-log-state">
            <FileSearch size={34} />

            <strong>No matching activity</strong>

            <p>
              {logs.length === 0
                ? "No system log entries have been recorded yet."
                : "Try changing your search text or filters."}
            </p>
          </div>
        ) : (
          <div className="system-log-table-scroll">
            <table className="system-log-data-table">
              <thead>
                <tr>
                  <th>Date &amp; Time</th>
                  <th>Action</th>
                  <th>User Email</th>
                  <th>Activity Performed</th>
                </tr>
              </thead>

              <tbody>
                {filteredLogs.map((log) => {
                  const ActionIcon = getActionIcon(log.action);
                  const actor = actorProfiles[log.actor_id];

                  const actorEmail =
                    log.details?.email ||
                    actor?.email ||
                    "Email unavailable";

                  const actorName =
                    log.details?.full_name ||
                    actor?.full_name ||
                    "System user";

                  return (
                    <tr key={log.id}>
                      <td>
                        <div className="system-log-date">
                          <strong>{formatDate(log.created_at)}</strong>
                          <span>{formatTime(log.created_at)}</span>
                        </div>
                      </td>

                      <td>
                        <span
                          className={`system-log-action-badge ${getActionClass(log.action)}`}
                        >
                          <ActionIcon size={13} />

                          {(log.action || "Unknown action")
                            .replaceAll("_", " ")
                            .toUpperCase()}
                        </span>
                      </td>

                      <td>
                        <div className="system-log-actor">
                          <span className="system-log-actor-icon">
                            <UserRound size={15} />
                          </span>

                          <div className="system-log-actor-copy">
                          <strong>{actorName}</strong>

                          </div>
                        </div>
                      </td>

                      <td>
                        <div className="system-log-activity">
                          <strong>{getActivityDescription(log)}</strong>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        <div className="system-log-panel-footer">
          <span>
            <ShieldCheck size={15} />
            Restricted to active Superadmin accounts
          </span>

          <span>
            <CalendarDays size={14} />
            Displaying all available database entries
          </span>
        </div>
      </div>
    </section>
  );
}

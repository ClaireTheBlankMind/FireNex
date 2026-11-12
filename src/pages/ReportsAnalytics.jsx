
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase.js";
import {
  Download,
  ChartNoAxesCombined,
  Flame,
  CheckCircle2,
  Clock,
} from "lucide-react";

import StatCard from "../components/StatCard";

function escapeCsv(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}


function downloadCsv(incidents, units, personnelNames) {
  const headers = [
    "Incident",
    "Barangay",
    "Location",
    "Priority",
    "Status",
    "Final Outcome",
    "Verification Remarks",
    "Outcome Recorded By",
    "Outcome Recorded At",
    "Assigned Unit",
    "Created At",
  ];

  const unitNames = new Map(
    units.map((unit) => [
      String(unit.id || unit.dbId || unit.databaseId || ""),
      unit.unit_name || unit.name || unit.unitName || "Not found",
    ])
  );

  
  const rows = incidents.map((incident) => {
    const recordedById =
      incident.outcome_recorded_by ??
      incident.outcomeRecordedBy ??
      null;

    const recordedByName = recordedById
      ? personnelNames[String(recordedById)] || "Name not found"
      : "Not recorded";

    const assignedUnitId =
      incident.assigned_unit_id ||
      incident.assignedUnit ||
      "";

    const assignedUnitName = assignedUnitId
      ? unitNames.get(String(assignedUnitId)) || "Not found"
      : "Unassigned";

    return [
      incident.description || "No description",
      incident.barangay || "",
      incident.location || incident.address || "",
      incident.priority || "",
      incident.status || "",
      incident.outcome || "",
      incident.outcome_remarks || "",
      recordedByName,
      incident.outcome_recorded_at || "",
      assignedUnitName,
      incident.createdAt || incident.created_at || "",
    ];
  });

  const csv = [headers, ...rows]
    .map((row) => row.map(escapeCsv).join(","))
    .join("\r\n");

  const blob = new Blob(["\uFEFF" + csv], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "FireNex-incident-report.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

export default function ReportsAnalytics({
  incidents = [],
  sensors = [],
  units = [],
}) {
  const incidentList = Array.isArray(incidents) ? incidents : [];
  const sensorList = Array.isArray(sensors) ? sensors : [];
  const unitList = Array.isArray(units) ? units : [];

  // Load locally saved simulated final outcomes FIRST.
  const [simulatedOutcomes, setSimulatedOutcomes] = useState(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem("firenex_simulated_outcomes_v1") || "{}"
      );

      return Array.isArray(saved)
        ? saved
        : Object.values(saved);
    } catch (error) {
      console.error("Could not load simulated outcomes:", error);
      return [];
    }
  });

  const [personnelLoading, setPersonnelLoading] = useState(false);
  const [personnelError, setPersonnelError] = useState("");
  const [personnelNames, setPersonnelNames] = useState({});

  // Merge Supabase incidents and locally saved simulated outcomes.
  const reportIncidents = useMemo(() => {
    const merged = new Map();

    for (const incident of incidentList) {
      const key = String(
        incident.id || incident.reference_no || ""
      );

      if (key) {
        merged.set(key, incident);
      }
    }

    for (const saved of simulatedOutcomes) {
      const key = String(
        saved.id || saved.reference_no || ""
      );

      if (!key) continue;

      merged.set(key, {
        ...merged.get(key),
        ...saved,
      });
    }

    return Array.from(merged.values());
  }, [incidentList, simulatedOutcomes]);

  // Load personnel names for finalized outcomes.
  useEffect(() => {
    let mounted = true;

    async function loadPersonnelNames() {
      const personnelIds = [
        ...new Set(
          reportIncidents
            .map((incident) => incident.outcome_recorded_by)
            .filter(Boolean)
            .map(String)
        ),
      ];

      if (personnelIds.length === 0) {
        setPersonnelNames({});
        setPersonnelLoading(false);
        setPersonnelError("");
        return;
      }

      setPersonnelLoading(true);
      setPersonnelError("");

      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", personnelIds);

        if (error) throw error;

        if (!mounted) return;

        const nameMap = {};

        for (const person of data || []) {
          nameMap[String(person.id)] =
            person.full_name || "Name unavailable";
        }

        setPersonnelNames(nameMap);
      } catch (error) {
        console.error("Could not load personnel names:", error);

        if (mounted) {
          setPersonnelError(
            error.message || "Could not load personnel names."
          );
        }
      } finally {
        if (mounted) {
          setPersonnelLoading(false);
        }
      }
    }

    loadPersonnelNames();

    return () => {
      mounted = false;
    };
  }, [reportIncidents]);

  // Calculate report statistics.
  const summary = useMemo(() => {
    const finalizedIncidents = reportIncidents.filter(
      (incident) =>
        ["Resolved", "False Alarm"].includes(incident.status) &&
        Boolean(incident.outcome)
    );

    const resolvedIncidents = reportIncidents.filter(
      (incident) => incident.status === "Resolved"
    );

    const resolved = resolvedIncidents.length;

    const unresolved = reportIncidents.filter(
      (incident) =>
        !["Resolved", "False Alarm", "Completed", "Cancelled"].includes(
          incident.status
        )
    ).length;

    const highPriority = reportIncidents.filter(
      (incident) =>
        incident.priority === "High" ||
        incident.priority === "Critical"
    ).length;

    const extinguishedByBFP = finalizedIncidents.filter(
      (incident) =>
        incident.outcome === "Fire Extinguished by BFP"
    ).length;

    const extinguishedByResidents = finalizedIncidents.filter(
      (incident) =>
        incident.outcome === "Extinguished by Residents"
    ).length;

    const falseAlarms = finalizedIncidents.filter(
      (incident) =>
        incident.outcome === "False Alarm"
    ).length;

    const unrecordedOutcome = reportIncidents.filter(
      (incident) =>
        ["Resolved", "False Alarm"].includes(incident.status) &&
        !incident.outcome
    ).length;

    return {
      resolved,
      unresolved,
      highPriority,
      extinguishedByBFP,
      extinguishedByResidents,
      falseAlarms,
      unrecordedOutcome,
      finalizedIncidents,
    };
  }, [reportIncidents]);

  const total = reportIncidents.length;

  const resolutionRate =
    total === 0
      ? 0
      : Math.round((summary.resolved / total) * 100);

  const statusCounts = [
    {
      label: "Reported",
      count: reportIncidents.filter(
        (incident) => incident.status === "Reported"
      ).length,
    },
    {
      label: "Confirmed",
      count: reportIncidents.filter(
        (incident) => incident.status === "Confirmed"
      ).length,
    },
    {
      label: "Dispatched",
      count: reportIncidents.filter(
        (incident) => incident.status === "Dispatched"
      ).length,
    },
    {
      label: "Responding",
      count: reportIncidents.filter(
        (incident) => incident.status === "Responding"
      ).length,
    },
    {
      label: "Resolved",
      count: summary.resolved,
    },
    {
      label: "False Alarm",
      count: reportIncidents.filter(
        (incident) => incident.status === "False Alarm"
      ).length,
    },
  ];

  const maxCount = Math.max(
    1,
    ...statusCounts.map((item) => item.count)
  );

  return (
    <div className="page-content">
      <div className="page-intro">
        <button
          className="primary-button"
          disabled={personnelLoading}
          onClick={() =>
            downloadCsv(reportIncidents, unitList, personnelNames)
          }
        >
          <Download size={17} />
          {personnelLoading ? "Loading Names..." : "Export CSV"}
        </button>
      </div>

      {personnelError && (
        <div className="info-note" role="alert">
          Personnel names could not be loaded: {personnelError}
          {" "}Check the profiles SELECT policy for the current user.
        </div>
      )}

      {/* Final Incident Outcomes */}
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h3>Final Incident Outcomes</h3>
            <p>
              Breakdown of verified outcomes for finalized incidents.
            </p>
          </div>
        </div>

        <div className="stats-grid">
          <StatCard
            label="Extinguished by BFP"
            value={summary.extinguishedByBFP}
            detail="Handled by BFP responders"
            icon={Flame}
            tone="green"
          />

          <StatCard
            label="Extinguished by Residents"
            value={summary.extinguishedByResidents}
            detail="Extinguished before BFP arrival"
            icon={CheckCircle2}
            tone="blue"
          />

          <StatCard
            label="False Alarms"
            value={summary.falseAlarms}
            detail="No actual fire verified"
            icon={Clock}
            tone="orange"
          />

          <StatCard
            label="Outcome Not Recorded"
            value={summary.unrecordedOutcome}
            detail="Older or incomplete finalized records"
            icon={Clock}
            tone="red"
          />
        </div>

        {/* Detailed finalized incident records */}
        <div className="table-wrapper" style={{ marginTop: 24 }}>
          <h4>Finalized Incident Records</h4>

          <table className="fire-incidents-table">
            <thead>
              <tr>
                <th>Incident ID</th>
                <th>Location</th>
                <th>Final Status</th>
                <th>Final Outcome</th>
                <th>Verification Remarks</th>
                <th>Recorded At</th>
              </tr>
            </thead>

            <tbody>
              {summary.finalizedIncidents.map((incident, index) => (
                <tr key={incident.id || index}>
                  <td>
                    <strong>
                      {incident.reference_no || incident.id || "No ID"}
                    </strong>
                  </td>

                  <td>
                    {incident.barangay ||
                      incident.location ||
                      incident.address ||
                      "Unavailable"}
                  </td>

                  <td>{incident.status}</td>

                  <td>
                    <strong>{incident.outcome}</strong>
                  </td>

                  <td>
                    {incident.outcome_remarks || "No remarks recorded"}
                  </td>

                  <td>
                    {incident.outcome_recorded_at
                      ? new Date(
                          incident.outcome_recorded_at
                        ).toLocaleString()
                      : "Unavailable"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {summary.finalizedIncidents.length === 0 && (
            <div className="empty-state">
              No finalized incident outcomes have been recorded.
            </div>
          )}
        </div>
      </section>

      <div className="two-column-grid">
        {/* Incident Status Breakdown */}
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h3>Incident Status Breakdown</h3>
              <p>Number of records by current status.</p>
            </div>
          </div>

          <div className="chart-list">
            {statusCounts.map((item) => (
              <div className="chart-row" key={item.label}>
                <div className="chart-row-heading">
                  <span>{item.label}</span>
                  <strong>{item.count}</strong>
                </div>

                <div className="bar-track">
                  <div
                    className="bar-fill"
                    style={{
                      width: `${(item.count / maxCount) * 100}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* System Summary */}
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h3>System Summary</h3>
              <p>Currently loaded system records.</p>
            </div>
          </div>

          <div className="summary-list">
            <div>
              <span>Incident records</span>
              <strong>{reportIncidents.length}</strong>
            </div>

            <div>
              <span>High/critical priority</span>
              <strong>{summary.highPriority}</strong>
            </div>

            <div>
              <span>Sensor records</span>
              <strong>{sensorList.length}</strong>
            </div>

            <div>
              <span>Response units</span>
              <strong>{unitList.length}</strong>
            </div>
          </div>

          <div className="info-note">
            Statistics include loaded Supabase incidents and locally
            saved simulated outcomes. Historical records without an
            outcome are not counted in the verified outcome categories.
          </div>
        </section>
      </div>
    </div>
  );
}

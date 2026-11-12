
import { useMemo, useState } from "react";
import { History, Search, CheckCircle2 } from "lucide-react";
import StatCard from "../components/StatCard";
import StatusBadge from "../components/StatusBadge";

export default function IncidentHistory({ incidents = [] }) {
  const [search, setSearch] = useState("");

  const incidentList = Array.isArray(incidents) ? incidents : [];

  // Display all incidents, regardless of status.
  const filteredIncidents = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return incidentList
      .filter((incident) =>
        [
          incident.title,
          incident.description,
          incident.barangay,
          incident.status,
          incident.priority,
          incident.outcome,
          incident.outcome_remarks,
          incident.source,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(keyword)
      )
      .sort(
        (a, b) =>
          new Date(b.created_at || b.createdAt || 0) -
          new Date(a.created_at || a.createdAt || 0)
      );
  }, [incidentList, search]);

  const resolvedCount = incidentList.filter(
    (incident) => incident.status === "Resolved"
  ).length;

  const outcomeCount = (outcome) =>
    incidentList.filter(
      (incident) =>
        incident.status === "Resolved" &&
        incident.outcome === outcome
    ).length;

  return (
    <div className="page-content">
      <div className="stats-grid">
        <StatCard
          label="Total Incidents"
          value={incidentList.length}
          detail="All recorded incidents"
          icon={History}
          tone="blue"
        />

        <StatCard
          label="Resolved Incidents"
          value={resolvedCount}
          detail="Successfully resolved"
          icon={CheckCircle2}
          tone="green"
        />

        <StatCard
          label="Extinguished by Residents"
          value={outcomeCount("Extinguished by Residents")}
          detail="Extinguished before BFP arrival"
          icon={History}
          tone="blue"
        />

        <StatCard
          label="False Alarms"
          value={outcomeCount("False Alarm")}
          detail="Verified false alarms"
          icon={History}
          tone="orange"
        />

        <StatCard
          label="Extinguished by BFP"
          value={outcomeCount("Fire Extinguished by BFP")}
          detail="Handled by response personnel"
          icon={CheckCircle2}
          tone="green"
        />
      </div>

      <section className="panel">
        <div className="panel-heading responsive-heading">
          <div>
            <h3>Incident History</h3>
            <p>
              Showing {filteredIncidents.length} of {incidentList.length} recorded incidents.
            </p>
          </div>

          <div className="search-field">
            <Search size={17} />

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search incident history..."
              aria-label="Search incident history"
            />
          </div>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Incident</th>
                <th>Barangay</th>
                <th>Priority</th>
                <th>Final Outcome</th>
                <th>Verification Remarks</th>
                <th>Status</th>
                <th>Recorded At</th>
              </tr>
            </thead>

            <tbody>
              {filteredIncidents.map((incident, index) => (
                <tr key={incident.id || index}>
                  <td>
                    {incident.title ||
                      incident.description?.split("\n")[0] ||
                      "Fire emergency"}
                  </td>

                  <td>{incident.barangay || "Not specified"}</td>

                  <td>
                    <StatusBadge
                      status={incident.priority || "Medium"}
                    />
                  </td>

                  <td>
                    {incident.outcome ? (
                      <StatusBadge status={incident.outcome} />
                    ) : (
                      "Not recorded"
                    )}
                  </td>

                  <td>
                    {incident.outcome_remarks || "No remarks recorded"}
                  </td>

                  <td>
                    <StatusBadge status={incident.status || "Reported"} />
                  </td>

                  <td>
                    {incident.created_at || incident.createdAt
                      ? new Date(
                          incident.created_at || incident.createdAt
                        ).toLocaleString()
                      : "Unavailable"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredIncidents.length === 0 && (
            <div className="empty-state">
              {incidentList.length === 0
                ? "No incidents have been recorded yet."
                : "No incidents match your search."}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

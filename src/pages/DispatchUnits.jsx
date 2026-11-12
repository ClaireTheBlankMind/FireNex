import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase.js";

const COMPLETED_STATUSES = [
  "Resolved",
  "Completed",
  "Cancelled",
];

const UNIT_STATUSES = [
  "Available",
  "Responding",
  "On Scene",
  "Out of Service",
];

const INCIDENT_STATUSES = [
  "Reported",
  "Responding",
  "On Scene",
  "Resolved",
  "Cancelled",
];

const styles = {
  page: {
    display: "flex",
    flexDirection: "column",
    gap: 22,
    color: "#172033",
  },
  heading: {
    margin: 0,
    fontSize: 25,
    fontWeight: 800,
  },
  muted: {
    color: "#64748b",
    fontSize: 13,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 14,
  },
  card: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: 18,
    minWidth: 0,
  },
  section: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: 18,
    minWidth: 0,
  },
  input: {
    boxSizing: "border-box",
    width: "100%",
    padding: "10px 12px",
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    background: "#ffffff",
    color: "#172033",
    fontSize: 14,
  },
  button: {
    padding: "10px 14px",
    borderRadius: 8,
    border: "1px solid #cbd5e1",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 13,
  },
  primaryButton: {
    background: "#b91c1c",
    color: "#ffffff",
    border: "1px solid #b91c1c",
  },
  secondaryButton: {
    background: "#ffffff",
    color: "#334155",
  },
  tableWrap: {
    width: "100%",
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 13,
    textAlign: "left",
  },
  th: {
    padding: "12px 10px",
    background: "#f8fafc",
    borderBottom: "1px solid #e2e8f0",
    color: "#475569",
    whiteSpace: "nowrap",
  },
  td: {
    padding: "13px 10px",
    borderBottom: "1px solid #e2e8f0",
    verticalAlign: "middle",
  },
};

function normalizeStatus(status) {
  return String(status || "").trim().toLowerCase();
}

function getUnitStatus(unit) {
  if (unit.active === false) {
    return "Out of Service";
  }

  return unit.status || "Available";
}

function getStatusStyle(status) {
  const normalized = normalizeStatus(status);

  if (["available", "resolved", "completed"].includes(normalized)) {
    return {
      background: "#dcfce7",
      color: "#166534",
    };
  }

  if (["dispatched", "responding", "on scene"].includes(normalized)) {
    return {
      background: "#dbeafe",
      color: "#1d4ed8",
    };
  }

  if (
    ["out of service", "cancelled", "critical", "high"].includes(
      normalized
    )
  ) {
    return {
      background: "#fee2e2",
      color: "#991b1b",
    };
  }

  return {
    background: "#f1f5f9",
    color: "#475569",
  };
}

function StatusBadge({ status }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "5px 9px",
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 800,
        whiteSpace: "nowrap",
        ...getStatusStyle(status),
      }}
    >
      {status || "Unknown"}
    </span>
  );
}

function getIncidentTitle(incident) {
  return (
    incident.title ||
    incident.description?.split("\n")[0] ||
    incident.reference_no ||
    "Fire emergency"
  );
}

function getIncidentLocation(incident) {
  return (
    incident.address ||
    incident.location ||
    incident.barangay ||
    "Location not specified"
  );
}

export default function DispatchUnits({
  units = [],
  setUnits,
  incidents = [],
  setIncidents,
  loading = false,
  loadError = "",
  notice = "",
  onRefresh,
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [incidentFilter, setIncidentFilter] = useState("All");

  const [selectedIncidentId, setSelectedIncidentId] = useState("");
  const [selectedUnitId, setSelectedUnitId] = useState("");

  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  const [dispatchRecords, setDispatchRecords] = useState([]);

const loadDispatchRecords = useCallback(async () => {
  const { data, error } = await supabase
    .from("dispatch_records")
    .select(`
      id,
      incident_id,
      unit_id,
      unit_name,
      vehicle_type,
      status,
      dispatched_at,
      completed_at
    `)
    .not("incident_id", "is", null)
    .in("status", ["Dispatched", "Responding", "On Scene"])
    .order("dispatched_at", { ascending: true });

  if (error) {
    throw error;
  }

  setDispatchRecords(data || []);
}, []);

useEffect(() => {
  loadDispatchRecords().catch((error) => {
    console.error("Could not load dispatch records:", error);
  });
}, [loadDispatchRecords]);

  const activeIncidents = useMemo(
    () =>
      incidents.filter(
        (incident) =>
          !COMPLETED_STATUSES.includes(
            String(incident.status || "")
          )
      ),
    [incidents]
  );

  const dispatchableIncidents = useMemo(
    () =>
      activeIncidents.filter(
        (incident) =>
          !incident.assigned_unit_id &&
          incident.review_status === "CONFIRMED" &&
          incident.status === "Confirmed"
      ),
    [activeIncidents]
  );

  const availableUnits = useMemo(
    () =>
      units.filter(
        (unit) =>
          unit.active !== false &&
          normalizeStatus(getUnitStatus(unit)) === "available"
      ),
    [units]
  );

  const dispatchedUnits = useMemo(
    () =>
      units.filter((unit) =>
        ["dispatched", "responding", "on scene"].includes(
          normalizeStatus(getUnitStatus(unit))
        )
      ),
    [units]
  );

  const filteredUnits = useMemo(() => {
    const query = search.trim().toLowerCase();

    return units.filter((unit) => {
      const name = String(unit.name || unit.unit_name || "");
      const type = String(unit.type || unit.vehicle_type || "");
      const status = getUnitStatus(unit);

      const matchesSearch =
        !query ||
        name.toLowerCase().includes(query) ||
        type.toLowerCase().includes(query) ||
        String(unit.id).toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "All" || status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [units, search, statusFilter]);

  const filteredIncidents = useMemo(() => {
    return activeIncidents.filter((incident) => {
      const assigned = Boolean(incident.assigned_unit_id);

      if (incidentFilter === "Assigned") {
        return assigned;
      }

      if (incidentFilter === "Unassigned") {
        return !assigned;
      }

      return true;
    });
  }, [activeIncidents, incidentFilter]);

  const dispatchRecordsByIncident = useMemo(() => {
  const grouped = new Map();

  dispatchRecords.forEach((record) => {
    if (!record.incident_id) return;

    const incidentId = String(record.incident_id);

    if (!grouped.has(incidentId)) {
      grouped.set(incidentId, []);
    }

    grouped.get(incidentId).push(record);
  });

  return grouped;
}, [dispatchRecords]);

  const selectedIncident = incidents.find(
    (incident) =>
      String(incident.id) === String(selectedIncidentId)
  );

  function clearMessages() {
    setActionError("");
    setActionSuccess("");
  }

  
async function handleDispatch(event) {
  event.preventDefault();
  clearMessages();

  if (!selectedIncidentId || !selectedUnitId) {
    setActionError("Please select an incident and a response unit.");
    return;
  }

  const incident = incidents.find(
    (item) => String(item.id) === String(selectedIncidentId)
  );

  const unit = units.find(
    (item) => String(item.id) === String(selectedUnitId)
  );

  if (!incident || !unit) {
    setActionError(
      "The selected incident or response unit could not be found. Refresh the data."
    );
    return;
  }

  const isUuid = (value) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      String(value || "")
    );

  const incidentDbId =
    incident.dbId ||
    incident.databaseId ||
    (isUuid(incident.id) ? incident.id : null);

  const unitDbId =
    unit.dbId ||
    unit.databaseId ||
    (isUuid(unit.id) ? unit.id : null);

  if (!incidentDbId || !unitDbId) {
    setActionError(
      "The incident or vehicle does not have a valid Supabase ID."
    );
    return;
  }

  if (
    unit.active === false ||
    normalizeStatus(getUnitStatus(unit)) !== "available"
  ) {
    setActionError(
      "This vehicle is no longer available. Refresh and select another vehicle."
    );
    return;
  }

  if (incident.assigned_unit_id) {
    setActionError(
      "This incident already has a dispatched vehicle."
    );
    return;
  }

  setBusy(true);

  try {
    const { data: dispatchId, error } = await supabase.rpc(
      "dispatch_vehicle_to_incident",
      {
        p_unit_id: unitDbId,
        p_incident_id: incidentDbId,
      }
    );

    if (error) {
      throw error;
    }

    if (!dispatchId) {
      throw new Error(
        "The database did not return a dispatch record ID."
      );
    }

    setActionSuccess(
      `${unit.name || unit.unit_name} was dispatched to ${getIncidentTitle(incident)}.`
    );

    setSelectedIncidentId("");
    setSelectedUnitId("");

    await loadDispatchRecords();

    if (onRefresh) {
      await onRefresh();
    }
  } catch (error) {
    console.error("Vehicle dispatch failed:", error);

    setActionError(
      error.message || "Could not dispatch the selected vehicle."
    );

    if (onRefresh) {
      await onRefresh();
    }
  } finally {
    setBusy(false);
  }
}


  // Update a unit's operational status.
  // Update vehicle status and synchronize its active dispatch and incident.
async function handleUnitStatusChange(unit, newStatus) {
  clearMessages();

  const oldStatus = getUnitStatus(unit);

  if (newStatus === oldStatus) return;

  if (newStatus === "Available" && unit.assignedIncident) {
    setActionError(
      "This unit has an active incident assignment. Complete or cancel the assignment before making it available."
    );
    return;
  }

  setBusy(true);

  try {
    const isActive = newStatus !== "Out of Service";

    // 1. Update the vehicle.
    const { data, error } = await supabase
      .from("response_units")
      .update({
        status: newStatus,
        active: isActive,
      })
      .eq("id", unit.id)
      .select("id, status, active")
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      throw new Error(
        "No vehicle was updated. Check Supabase permissions and refresh."
      );
    }

    const incidentStatusUpdates = {};

    // 2. Synchronize active dispatch records when the vehicle
    //    is Responding or On Scene.
    if (["Responding", "On Scene"].includes(newStatus)) {
      const { data: updatedDispatches, error: dispatchError } =
        await supabase
          .from("dispatch_records")
          .update({ status: newStatus })
          .eq("unit_id", unit.id)
          .not("incident_id", "is", null)
          .in("status", ["Dispatched", "Responding", "On Scene"])
          .select("incident_id");

      if (dispatchError) {
        throw new Error(
          `Vehicle updated, but dispatch progress could not be updated: ${dispatchError.message}`
        );
      }

      // Only process dispatch records connected to actual incidents.
      const incidentIds = [
        ...new Set(
          (updatedDispatches || [])
            .map((record) => record.incident_id)
            .filter(Boolean)
        ),
      ];

      // 3. Calculate the progress of each affected incident.
      for (const incidentId of incidentIds) {
        const { data: assignments, error: assignmentsError } =
          await supabase
            .from("dispatch_records")
            .select("status")
            .eq("incident_id", incidentId)
            .in("status", ["Dispatched", "Responding", "On Scene"]);

        if (assignmentsError) throw assignmentsError;

        if (!assignments?.length) continue;

        const allOnScene = assignments.every(
          (record) =>
            normalizeStatus(record.status) === "on scene"
        );

        const nextIncidentStatus = allOnScene
          ? "On Scene"
          : "Responding";

        // Never overwrite a final incident outcome.
        const { data: incidentRecord, error: incidentReadError } =
          await supabase
            .from("incidents")
            .select("id, status")
            .eq("id", incidentId)
            .maybeSingle();

        if (incidentReadError) throw incidentReadError;
        if (!incidentRecord) continue;

        const finalStatuses = [
          "resolved",
          "completed",
          "cancelled",
          "false alarm",
          "fire extinguished by bfp",
          "fire extinguished by residents",
          "extinguished by bfp",
          "extinguished by residents",
        ];

        if (
          finalStatuses.includes(
            normalizeStatus(incidentRecord.status)
          )
        ) {
          continue;
        }

        const { error: incidentUpdateError } = await supabase
          .from("incidents")
          .update({
            status: nextIncidentStatus,
            updated_at: new Date().toISOString(),
          })
          .eq("id", incidentId);

        if (incidentUpdateError) throw incidentUpdateError;

        incidentStatusUpdates[String(incidentId)] =
          nextIncidentStatus;
      }
    }

    // 4. Update the React state.
    setUnits((previous) =>
      previous.map((item) =>
        String(item.id) === String(data.id)
          ? {
              ...item,
              status: data.status,
              active: data.active,
            }
          : item
      )
    );

    setIncidents((previous) =>
      previous.map((incident) => ({
        ...incident,
        ...(incidentStatusUpdates[String(incident.dbId || incident.id)]
          ? {
              status:
                incidentStatusUpdates[
                  String(incident.dbId || incident.id)
                ],
            }
          : {}),
      }))
    );

    setActionSuccess(
      `${unit.name || unit.unit_name} status updated to ${data.status}. Dispatch and incident progress synchronized.`
    );

    if (onRefresh) {
      await onRefresh();
    }
  } catch (error) {
    console.error("Unit status synchronization failed:", error);

    setActionError(
      error.message || "Could not synchronize vehicle and incident status."
    );

    // Reload data because an earlier database update may already have succeeded.
    if (onRefresh) {
      await onRefresh();
    }
  } finally {
    setBusy(false);
  }
}

  // Advance the status of an assigned incident.
  async function handleIncidentStatusChange(incident, newStatus) {
    clearMessages();

    if (
      ["Responding", "On Scene"].includes(newStatus) &&
      !incident.assigned_unit_id
    ) {
      setActionError(
        "Assign a response unit before updating this incident to a dispatch status."
      );
      return;
    }

    setBusy(true);

    try {
      const { data, error } = await supabase
        .from("incidents")
        .update({
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", incident.id)
        .select("id, status, assigned_unit_id");

      if (error) throw error;

      if (!data?.length) {
        throw new Error(
          "No incident was updated. Check your permissions and refresh the data."
        );
      }

      // Release the assigned unit when the incident is completed/cancelled.
      if (
        COMPLETED_STATUSES.includes(newStatus) &&
        incident.assigned_unit_id
      ) {
        const { error: releaseError } = await supabase
          .from("response_units")
          .update({ status: "Available" })
          .eq("id", incident.assigned_unit_id)
          .in("status", ["Responding", "On Scene"]);

        if (releaseError) {
          throw new Error(
            `Incident status was updated, but the unit could not be released: ${releaseError.message}. Refresh the data and check the unit status.`
          );
        }
      }

      setIncidents((previous) =>
        previous.map((item) =>
          String(item.id) === String(incident.id)
            ? {
                ...item,
                status: newStatus,
                updated_at: new Date().toISOString(),
                ...(COMPLETED_STATUSES.includes(newStatus)
                  ? {
                      assigned_unit_id: null,
                      assignedUnit: "",
                    }
                  : {}),
              }
            : item
        )
      );

      if (
        COMPLETED_STATUSES.includes(newStatus) &&
        incident.assigned_unit_id
      ) {
        setUnits((previous) =>
          previous.map((unit) =>
            String(unit.id) === String(incident.assigned_unit_id)
              ? {
                  ...unit,
                  status: "Available",
                  assignedIncident: "",
                }
              : unit
          )
        );
      }

      setActionSuccess(
        `Incident ${incident.reference_no || incident.id} updated to ${newStatus}.`
      );

      if (onRefresh) {
        await onRefresh();
      }
    } catch (error) {
      console.error("Incident status update failed:", error);
      setActionError(
        error.message || "Could not update incident status."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={styles.page}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 14,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2 style={styles.heading}>Dispatch &amp; Units</h2>
          <p style={styles.muted}>
            Manage BFP response vehicles and incident assignments.
          </p>
        </div>

        <button
          type="button"
          style={{
            ...styles.button,
            ...styles.primaryButton,
            opacity: loading ? 0.65 : 1,
          }}
          disabled={loading || busy || !onRefresh}
          onClick={onRefresh}
        >
          {loading ? "Refreshing..." : "Refresh Data"}
        </button>
      </div>

      {loadError && (
        <div
          role="alert"
          style={{
            padding: 14,
            borderRadius: 9,
            background: "#fee2e2",
            color: "#991b1b",
            border: "1px solid #fecaca",
          }}
        >
          <strong>Could not load dispatch data.</strong>
          <p style={{ marginBottom: 0 }}>{loadError}</p>
        </div>
      )}

      {notice && !loadError && (
        <div
          role="status"
          style={{
            padding: 14,
            borderRadius: 9,
            background: "#fff7ed",
            color: "#9a3412",
            border: "1px solid #fed7aa",
          }}
        >
          {notice}
        </div>
      )}

      {actionError && (
        <div
          role="alert"
          style={{
            padding: 14,
            borderRadius: 9,
            background: "#fee2e2",
            color: "#991b1b",
            border: "1px solid #fecaca",
          }}
        >
          <strong>Action failed:</strong> {actionError}
        </div>
      )}

      {actionSuccess && (
        <div
          role="status"
          style={{
            padding: 14,
            borderRadius: 9,
            background: "#dcfce7",
            color: "#166534",
            border: "1px solid #bbf7d0",
          }}
        >
          {actionSuccess}
        </div>
      )}

      <div style={styles.grid}>
        {[
          {
            label: "Total Units",
            value: units.length,
            color: "#1d4ed8",
          },
          {
            label: "Available",
            value: availableUnits.length,
            color: "#15803d",
          },
          {
            label: "Dispatched / Responding",
            value: dispatchedUnits.length,
            color: "#b45309",
          },
          {
            label: "Active Incidents",
            value: activeIncidents.length,
            color: "#b91c1c",
          },
        ].map((item) => (
          <div key={item.label} style={styles.card}>
            <div style={styles.muted}>{item.label}</div>
            <div
              style={{
                fontSize: 30,
                fontWeight: 800,
                color: item.color,
                marginTop: 8,
              }}
            >
              {item.value}
            </div>
          </div>
        ))}
      </div>

      <section style={styles.section}>
        <h3 style={{ marginTop: 0 }}>Dispatched a Response Unit</h3>
          <p style={styles.muted}>
            Select an active incident and an available vehicle to dispatch.
            The dispatch record will be saved to Supabase.
          </p>

        <form onSubmit={handleDispatch}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 14,
            }}
          >
            <label style={{ fontSize: 13, fontWeight: 700 }}>
              Fire Incident
              <select
                style={{ ...styles.input, marginTop: 7 }}
                value={selectedIncidentId}
                onChange={(event) =>
                  setSelectedIncidentId(event.target.value)
                }
                disabled={busy || loading}
                required
              >
                <option value="">Select an incident</option>
                {dispatchableIncidents.map((incident) => (
                  <option key={incident.id} value={incident.id}>
                    {incident.reference_no || incident.id.slice(0, 8)}
                    {" — "}
                    {getIncidentTitle(incident)}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ fontSize: 13, fontWeight: 700 }}>
              Available Response Unit
              <select
                style={{ ...styles.input, marginTop: 7 }}
                value={selectedUnitId}
                onChange={(event) => setSelectedUnitId(event.target.value)}
                disabled={busy || loading}
                required
              >
                <option value="">Select a response unit</option>
                {availableUnits.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name || unit.unit_name}
                    {" — "}
                    {unit.type || unit.vehicle_type}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {selectedIncident && (
            <div
              style={{
                marginTop: 14,
                padding: 12,
                background: "#f8fafc",
                borderRadius: 8,
                fontSize: 13,
              }}
            >
              <strong>Incident location:</strong>{" "}
              {getIncidentLocation(selectedIncident)}
              <br />
              <strong>Current status:</strong>{" "}
              {selectedIncident.status || "Reported"}
            </div>
          )}

          <button
            type="submit"
            disabled={
              busy ||
              loading ||
              !selectedIncidentId ||
              !selectedUnitId
            }
            style={{
              ...styles.button,
              ...styles.primaryButton,
              marginTop: 16,
              opacity:
                busy || loading || !selectedIncidentId || !selectedUnitId
                  ? 0.55
                  : 1,
            }}
          >
            {busy ? "Processing..." : "Dispatch Selected Unit"}
          </button>

          {availableUnits.length === 0 && (
            <p style={{ ...styles.muted, marginTop: 12 }}>
              No available units found. Refresh the data or update the
              status of an eligible vehicle.
            </p>
          )}
        </form>
      </section>

      <section style={styles.section}>
        <h3 style={{ marginTop: 0 }}>Response Units</h3>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 12,
            marginBottom: 18,
          }}
        >
          <input
            style={styles.input}
            placeholder="Search name, vehicle type, or ID..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          <select
            style={styles.input}
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="All">All statuses</option>
            {UNIT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>

        {loading && units.length === 0 ? (
          <p style={styles.muted}>Loading response units from Supabase...</p>
        ) : filteredUnits.length === 0 ? (
          <p style={styles.muted}>
            {units.length === 0
              ? "No response units are currently available in the loaded data."
              : "No units match your search or status filter."}
          </p>
        ) : (
          <div style={styles.grid}>
            {filteredUnits.map((unit) => {
              const status = getUnitStatus(unit);

              return (
                <article
                  key={unit.id}
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: 10,
                    padding: 16,
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 8,
                      alignItems: "flex-start",
                    }}
                  >
                    <div>
                      <h4 style={{ margin: "0 0 5px" }}>
                        {unit.name || unit.unit_name || "Unnamed Unit"}
                      </h4>
                      <p style={{ ...styles.muted, margin: 0 }}>
                        {unit.type || unit.vehicle_type || "Response Unit"}
                      </p>
                    </div>
                    <StatusBadge status={status} />
                  </div>

                  {unit.assignedIncident && (
                    <p style={{ fontSize: 12 }}>
                      Assigned to an active incident.
                    </p>
                  )}

                  <label
                    style={{
                      display: "block",
                      fontSize: 12,
                      fontWeight: 700,
                      marginTop: 12,
                    }}
                  >
                    Update unit status
                    <select
                      style={{ ...styles.input, marginTop: 6 }}
                      value={status}
                      disabled={busy || loading}
                      onChange={(event) =>
                        handleUnitStatusChange(unit, event.target.value)
                      }
                    >
                      {UNIT_STATUSES.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section style={styles.section}>
        <h3 style={{ marginTop: 0 }}>Active Incidents &amp; Dispatch Status</h3>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <select
            style={{ ...styles.input, maxWidth: 240 }}
            value={incidentFilter}
            onChange={(event) => setIncidentFilter(event.target.value)}
          >
            <option value="All">All active incidents</option>
            <option value="Assigned">Incidents with dispatched units</option>
            <option value="Unassigned">Incidents without dispatched units</option>
          </select>
        </div>

        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Reference</th>
                <th style={styles.th}>Incident</th>
                <th style={styles.th}>Location</th>
                <th style={styles.th}>Assigned Unit</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Unit Progress</th>
              </tr>
            </thead>

            <tbody>
              {filteredIncidents.map((incident) => {
                const incidentDispatches =
                  dispatchRecordsByIncident.get(String(incident.id)) || [];

                const assignedVehicles = incidentDispatches.map((record) => {
                  const unit = units.find(
                    (item) => String(item.id) === String(record.unit_id)
                  );

                  return {
                    id: record.id,
                    name:
                      unit?.name ||
                      unit?.unit_name ||
                      record.unit_name ||
                      "Unnamed Unit",
                    status: unit
                      ? getUnitStatus(unit)
                      : record.status || "Unknown",
                  };
                });

                // Backward compatibility for older assignments
                // that only have incidents.assigned_unit_id.
                if (assignedVehicles.length === 0 && incident.assigned_unit_id) {
                  const legacyUnit = units.find(
                    (unit) =>
                      String(unit.id) === String(incident.assigned_unit_id)
                  );

                  if (legacyUnit) {
                    assignedVehicles.push({
                      id: legacyUnit.id,
                      name: legacyUnit.name || legacyUnit.unit_name || "Unnamed Unit",
                      status: getUnitStatus(legacyUnit),
                    });
                  }
                }

                const vehicleStatuses = assignedVehicles.map((vehicle) =>
                  normalizeStatus(vehicle.status)
                );

                  const incidentDisplayStatus =
                    vehicleStatuses.length === 0
                      ? incident.status || "Reported"
                      : vehicleStatuses.every((status) => status === "on scene")
                        ? "On Scene"
                        : vehicleStatuses.some((status) =>
                            ["dispatched", "responding", "on scene"].includes(status)
                          )
                          ? "Responding"
                          : incident.status || "Reported";

                return (
                  <tr key={incident.id}>
                    <td style={styles.td}>
                      {incident.reference_no ||
                        String(incident.id).slice(0, 8)}
                    </td>

                    <td style={styles.td}>
                      {getIncidentTitle(incident)}
                    </td>

                    <td style={styles.td}>
                      {getIncidentLocation(incident)}
                    </td>

                    <td style={styles.td}>
                      {assignedVehicles.length > 0 ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                          {assignedVehicles.map((vehicle) => (
                            <span key={vehicle.id}>{vehicle.name}</span>
                          ))}
                        </div>
                      ) : (
                        "Unassigned"
                      )}
                    </td>
                    

                    {/* STATUS COLUMN */}
                    <td style={styles.td}>
                      <StatusBadge status={incidentDisplayStatus} />
                    </td>

                    {/* UNIT PROGRESS COLUMN */}
                    <td style={styles.td}>
                      {assignedVehicles.length === 0 ? (
                        <span style={styles.muted}>No assigned unit</span>
                      ) : assignedVehicles.length === 1 ? (
                        <StatusBadge status={assignedVehicles[0].status} />
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {assignedVehicles.map((vehicle) => (
                            <div
                              key={vehicle.id}
                              style={{ display: "flex", justifyContent: "space-between", gap: 10 }}
                            >
                              <span>{vehicle.name}</span>
                              <StatusBadge status={vehicle.status} />
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}

              {filteredIncidents.length === 0 && (
                <tr>
                  <td
                    style={{ ...styles.td, textAlign: "center" }}
                    colSpan={6}
                  >
                    No active incidents match this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
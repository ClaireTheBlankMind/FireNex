import { useEffect, useMemo, useState } from "react";
import { Search, ClipboardCheck } from "lucide-react";
import StatusBadge from "../components/StatusBadge";
import { supabase } from "../lib/supabase.js";

const OUTCOMES = [
  "Fire Extinguished by BFP",
  "Extinguished by Residents",
  "False Alarm",
];

const FINAL_STATUSES = ["Resolved", "False Alarm"];

const ACTIVE_DISPATCH_STATUSES = [
  "Dispatched",
  "Responding",
  "On Scene",
];

const SIMULATED_REVIEWS_KEY = "firenex_simulated_reviews_v1";
const SIMULATED_OUTCOMES_KEY = "firenex_simulated_outcomes_v1";

// =====================================================
// SYSTEM ACTIVITY / AUDIT LOGGING
// =====================================================

async function recordSystemActivity({
  action,
  incident,
  activity,
  extraDetails = {},
}) {
  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) throw userError;

    if (!user) {
      throw new Error("No authenticated user found.");
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.warn(
        "Could not retrieve profile name for audit log:",
        profileError.message
      );
    }

    const incidentId =
      incident?.dbId ||
      incident?.databaseId ||
      incident?.id;

    const isValidUuid =
      typeof incidentId === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        incidentId
      );

    const logEntry = {
      actor_id: user.id,
      action,
      entity_type: "fire_incident",
      details: {
        email: user.email,
        full_name: profile?.full_name || null,
        activity,
        incident_reference:
          incident?.reference_no || incident?.id || null,
        incident_title:
          incident?.title || incident?.description || null,
        ...extraDetails,
      },
    };

    // Only include entity_id when a valid UUID is available.
    if (isValidUuid) {
      logEntry.entity_id = incidentId;
    }

    const { error: logError } = await supabase
      .from("system_logs")
      .insert(logEntry);

    if (logError) throw logError;

  } catch (error) {
    // Logging failure must not undo a successful incident operation.
    console.error("System activity logging failed:", error);
  }
}

export default function FireIncidents({
  incidents = [],
  setIncidents,
  onRefresh,
}) {
  const [search, setSearch] = useState("");
  const [selectedIncident, setSelectedIncident] = useState(null);

  const [savingOutcome, setSavingOutcome] = useState(false);
  const [savingReviewId, setSavingReviewId] = useState(null);
  const [reviewForm, setReviewForm] = useState(null);
  const [reviewReason, setReviewReason] = useState("");
  const [reviewNotice, setReviewNotice] = useState(null);

  const [outcomeForm, setOutcomeForm] = useState({
    outcome: "",
    remarks: "",
  });

  const incidentList = Array.isArray(incidents) ? incidents : [];

// RESTORE SIMULATED REVIEWS AFTER BROWSER REFRESH
useEffect(() => {
  if (!setIncidents) return;

  try {
    const savedReviews = JSON.parse(
      localStorage.getItem(SIMULATED_REVIEWS_KEY) || "{}"
    );

    if (Object.keys(savedReviews).length === 0) return;

    setIncidents((previous) => {
      let changed = false;

      const restored = previous.map((incident) => {
        const key = String(
          incident.id || incident.reference_no || ""
        );

        const savedReview = savedReviews[key];

        if (!savedReview) return incident;

        const alreadyRestored =
          incident.review_status === savedReview.review_status &&
          incident.review_reason === savedReview.review_reason &&
          incident.status === savedReview.status &&
          incident.updated_at === savedReview.updated_at;

        if (alreadyRestored) return incident;

        changed = true;

        return {
          ...incident,
          ...savedReview,
        };
      });

      return changed ? restored : previous;
    });
  } catch (error) {
    console.error("Could not restore simulated reviews:", error);
  }

// Run only when the component mounts.
}, []);

// RESTORE SIMULATED FINAL OUTCOMES AFTER REFRESH
useEffect(() => {
  if (!setIncidents) return;

  try {
    const savedOutcomes = JSON.parse(
      localStorage.getItem(SIMULATED_OUTCOMES_KEY) || "{}"
    );

    if (Object.keys(savedOutcomes).length === 0) return;

    setIncidents((previous) => {
      let changed = false;

      const restored = previous.map((incident) => {
        const key = String(
          incident.id || incident.reference_no || ""
        );

        const saved = savedOutcomes[key];

        if (!saved) return incident;

        const alreadyRestored =
          incident.status === saved.status &&
          incident.outcome === saved.outcome &&
          incident.outcome_remarks === saved.outcome_remarks &&
          incident.outcome_recorded_at ===
            saved.outcome_recorded_at;

        if (alreadyRestored) return incident;

        changed = true;

        return {
          ...incident,
          ...saved,
        };
      });

      return changed ? restored : previous;
    });
  } catch (error) {
    console.error(
      "Could not restore simulated final outcomes:",
      error
    );
  }

// Run only when the component mounts.
}, []);

  // =====================================================
  // INCIDENT CLASSIFICATION
  // =====================================================

  const active = useMemo(
    () =>
      incidentList.filter(
        (incident) =>
          ![
            "Resolved",
            "False Alarm",
            "Completed",
            "Cancelled",
          ].includes(incident?.status)
      ),
    [incidentList]
  );

  const resolved = useMemo(
    () =>
      incidentList.filter((incident) =>
        FINAL_STATUSES.includes(incident?.status)
      ),
    [incidentList]
  );

  function getPriority(incident) {
    return "Unverified";
  }

  function getIncidentTitle(incident) {
    return incident?.title || incident?.description || "Untitled incident";
  }

  function getIncidentLocation(incident) {
    return (
      incident?.barangay ||
      incident?.location ||
      "Location unavailable"
    );
  }

  function isUuid(value) {
    return (
      typeof value === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        value
      )
    );
  }

  function getDatabaseId(incident) {
    return [
      incident?.dbId,
      incident?.databaseId,
      incident?.id,
    ].find(isUuid);
  }

  // =====================================================
  // SIMULATED INCIDENT DETECTION
  // =====================================================

  function isSimulatedIncident(incident) {
    return (
      incident?.isTest === true ||
      incident?.source === "Simulated Resident Request" ||
      String(incident?.title || "").includes(
        "SIMULATED RESCUE REQUEST"
      ) ||
      String(incident?.description || "").includes(
        "SIMULATED RESCUE REQUEST"
      )
    );
  }

  // =====================================================
  // CHECK WHETHER AN INCIDENT CAN RECEIVE AN OUTCOME
  // =====================================================

  function canRecordOutcome(incident) {
    if (isSimulatedIncident(incident)) {
      return (
        !FINAL_STATUSES.includes(incident?.status) &&
        !["Completed", "Cancelled"].includes(incident?.status)
      );
    }

    return (
      ACTIVE_DISPATCH_STATUSES.includes(incident?.status) &&
      Boolean(incident?.assigned_unit_id)
    );
  }

  // =====================================================
  // SEARCH
  // =====================================================

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return active.filter((incident) => {
      const searchableText = [
        incident?.title,
        incident?.barangay,
        incident?.location,
        incident?.status,
        incident?.review_status,
        incident?.review_reason,
        incident?.priority,
        incident?.severity,
        incident?.source,
        incident?.description,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(keyword);
    });
  }, [active, search]);

  // =====================================================
  // RESCUE REQUEST REVIEW FORM
  // =====================================================

  function openReviewForm(incident, decision) {
    setReviewReason("");

    setReviewForm({
      incident,
      decision,
    });
  }

  function closeReviewForm() {
    if (savingReviewId) return;

    setReviewForm(null);
    setReviewReason("");
  }

  async function submitReviewForm(event) {
    event.preventDefault();

    if (!reviewForm) return;

    await updateStatus(
      reviewForm.incident,
      reviewForm.decision,
      reviewReason
    );
  }

  // =====================================================
  // CONFIRM OR REJECT RESCUE REQUEST
  // =====================================================

  async function updateStatus(incident, decision, reason = "") {
    if (!["CONFIRMED", "REJECTED"].includes(decision)) {
      return;
    }

    const currentStatus = String(
      incident?.status || ""
    ).toLowerCase();

    const reviewStatus = String(
      incident?.review_status || "PENDING"
    ).toUpperCase();

    if (
      [
        "resolved",
        "false alarm",
        "completed",
        "cancelled",
      ].includes(currentStatus) ||
      (reviewStatus !== "PENDING" && reviewStatus !== "NONE")
    ) {
      alert("This incident has already been finalized or reviewed.");
      return;
    }

    reason = decision === "REJECTED" ? reason.trim() : null;

    if (decision === "REJECTED" && !reason) {
      alert("A rejection reason is required.");
      return;
    }

    const dbId = getDatabaseId(incident);

    // -------------------------------------------------
    // SIMULATED INCIDENTS: SAVE LOCALLY
    // -------------------------------------------------

    if (isSimulatedIncident(incident) || !dbId) {
      const updatedAt = new Date().toISOString();

      const updatedReview = {
        review_status: decision,
        review_reason: reason,
        status: decision === "CONFIRMED" ? "Confirmed" : "Reported",
        updated_at: updatedAt,
      };

      try {
        const savedReviews = JSON.parse(
          localStorage.getItem(SIMULATED_REVIEWS_KEY) || "{}"
        );

        const reviewKey = String(
          incident.id || incident.reference_no || ""
        );

        savedReviews[reviewKey] = updatedReview;

        localStorage.setItem(
          SIMULATED_REVIEWS_KEY,
          JSON.stringify(savedReviews)
        );

        // Record audit activity in Supabase.
        await recordSystemActivity({
          action:
            decision === "CONFIRMED"
              ? "CONFIRM_RESCUE_REQUEST"
              : "REJECT_RESCUE_REQUEST",
          incident,
          activity:
            decision === "CONFIRMED"
              ? "Confirmed a rescue request"
              : "Rejected a rescue request",
          extraDetails: {
            review_status: decision,
            review_reason: reason,
            simulated: true,
          },
        });

        // Update displayed incident.
        if (setIncidents) {
          setIncidents((previous) =>
            previous.map((item) =>
              item.id === incident.id
                ? {
                    ...item,
                    ...updatedReview,
                  }
                : item
            )
          );
        }

        setReviewForm(null);
        setReviewReason("");

        setReviewNotice({
          type: decision === "CONFIRMED" ? "success" : "danger",
          title:
            decision === "CONFIRMED"
              ? "Request Successfully Confirmed"
              : "Request Successfully Rejected",
          message:
            decision === "CONFIRMED"
              ? "The simulated rescue request has been confirmed and saved locally."
              : "The simulated rescue request has been rejected and saved locally.",
        });
      } catch (error) {
        console.error("Could not save simulated review:", error);

        alert(
          "Could not save the review decision in browser storage."
        );
      }

      return;
    }

    // -------------------------------------------------
    // REAL INCIDENTS: SAVE THROUGH SUPABASE RPC
    // -------------------------------------------------

    setSavingReviewId(dbId);

    try {
      const { data, error } = await supabase.rpc(
        "review_incident",
        {
          p_incident_id: dbId,
          p_decision: decision,
          p_reason: reason,
        }
      );

      if (error) throw error;

      if (!data) {
        throw new Error(
          "The review function did not return an incident ID."
        );
      }

      // Record audit activity only after successful review.
      await recordSystemActivity({
        action:
          decision === "CONFIRMED"
            ? "CONFIRM_RESCUE_REQUEST"
            : "REJECT_RESCUE_REQUEST",
        incident,
        activity:
          decision === "CONFIRMED"
            ? "Confirmed a rescue request"
            : "Rejected a rescue request",
        extraDetails: {
          review_status: decision,
          review_reason: reason,
          simulated: false,
        },
      });

      if (setIncidents) {
        setIncidents((previous) =>
          previous.map((item) =>
            String(
              item.dbId || item.databaseId || item.id
            ) === String(dbId)
              ? {
                  ...item,
                  review_status: decision,
                  review_reason: reason,
                  status:
                    decision === "CONFIRMED"
                      ? "Confirmed"
                      : "Reported",
                  updated_at: new Date().toISOString(),
                }
              : item
          )
        );
      }

      setReviewForm(null);
      setReviewReason("");

      alert(
        decision === "CONFIRMED"
          ? "Rescue request confirmed. It is now eligible for vehicle dispatch."
          : "Rescue request rejected. The rejection reason has been recorded."
      );

      if (onRefresh) {
        await onRefresh();
      }
    } catch (error) {
      console.error("Failed to review incident:", error);

      alert(`Could not review incident: ${error.message}`);
    } finally {
      setSavingReviewId(null);
    }
  }

  // =====================================================
  // OPEN OUTCOME FORM
  // =====================================================

  function openOutcomeForm(incident, outcome) {
    if (!OUTCOMES.includes(outcome)) return;

    if (!canRecordOutcome(incident)) {
      alert(
        "The incident must have an active dispatch and an assigned vehicle before recording its final outcome."
      );

      return;
    }

    setSelectedIncident(incident);

    setOutcomeForm({
      outcome,
      remarks: "",
    });
  }

  // =====================================================
  // RECORD FINAL INCIDENT OUTCOME
  // =====================================================

  async function recordOutcome(event) {
    event.preventDefault();

    if (!selectedIncident || savingOutcome) return;

    const outcome = outcomeForm.outcome;
    const remarks = outcomeForm.remarks.trim();

    if (!OUTCOMES.includes(outcome)) {
      alert("Please select a valid incident outcome.");
      return;
    }

    if (!remarks) {
      alert("Please enter the verification remarks.");
      return;
    }

    const dbId = getDatabaseId(selectedIncident);
    const recordedAt = new Date().toISOString();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) throw userError;

    if (!user) {
      throw new Error("No authenticated user found.");
    }

    const finalStatus =
      outcome === "False Alarm" ? "False Alarm" : "Resolved";

    setSavingOutcome(true);

    try {
      // -------------------------------------------------
      // SIMULATED INCIDENTS: SAVE LOCALLY
      // -------------------------------------------------

      if (isSimulatedIncident(selectedIncident)) {
        const outcomeKey = String(
          selectedIncident.id ||
          selectedIncident.reference_no ||
          ""
        );

        if (!outcomeKey) {
          throw new Error(
            "The simulated incident has no valid ID."
          );
        }

        const savedOutcomes = JSON.parse(
          localStorage.getItem(SIMULATED_OUTCOMES_KEY) || "{}"
        );

        const updatedOutcome = {
          ...selectedIncident,
          status: finalStatus,
          outcome,
          outcome_remarks: remarks,
          outcome_recorded_by: user.id,
          outcome_recorded_at: recordedAt,
          assigned_unit_id: null,
          updatedAt: recordedAt,
          updated_at: recordedAt,
        };

        savedOutcomes[outcomeKey] = updatedOutcome;

        localStorage.setItem(
          SIMULATED_OUTCOMES_KEY,
          JSON.stringify(savedOutcomes)
        );

        // Record audit activity in Supabase.
        await recordSystemActivity({
          action: "RECORD_FINAL_OUTCOME",
          incident: selectedIncident,
          activity: "Recorded final incident outcome",
          extraDetails: {
            outcome,
            final_status: finalStatus,
            remarks,
            simulated: true,
          },
        });

        // Update displayed incident.
        if (setIncidents) {
          setIncidents((previous) =>
            previous.map((item) => {
              const itemKey = String(
                item.id || item.reference_no || ""
              );

              return itemKey === outcomeKey
                ? {
                    ...item,
                    ...updatedOutcome,
                  }
                : item;
            })
          );
        }

        setSelectedIncident(null);

        setOutcomeForm({
          outcome: "",
          remarks: "",
        });

        setReviewNotice({
          type: "success",
          title: "Final Incident Outcome Recorded",
          message: `${outcome}. The final status is ${finalStatus}. The outcome and verification remarks have been saved locally.`,
        });

        return;
      }

      // -------------------------------------------------
      // REAL INCIDENTS: VALIDATE DISPATCH
      // -------------------------------------------------

      if (
        !ACTIVE_DISPATCH_STATUSES.includes(
          selectedIncident.status
        ) ||
        !selectedIncident.assigned_unit_id
      ) {
        throw new Error(
          "The real incident must have an active dispatch and an assigned vehicle."
        );
      }

      if (!dbId) {
        throw new Error(
          "No valid Supabase incident ID was found. Refresh the incident list."
        );
      }

      // -------------------------------------------------
      // SAVE THROUGH SECURE SUPABASE RPC
      // -------------------------------------------------

      const { data, error } = await supabase.rpc(
        "complete_vehicle_incident",
        {
          p_incident_id: dbId,
          p_final_status: finalStatus,
          p_outcome: outcome,
          p_outcome_remarks: remarks,
        }
      );

      if (error) throw error;

      if (!data) {
        throw new Error(
          "The completion function did not return a dispatch ID."
        );
      }

      // Record audit activity only after successful completion.
      await recordSystemActivity({
        action: "RECORD_FINAL_OUTCOME",
        incident: selectedIncident,
        activity: "Recorded final incident outcome",
        extraDetails: {
          outcome,
          final_status: finalStatus,
          remarks,
          simulated: false,
        },
      });

      // -------------------------------------------------
      // UPDATE LOCAL INCIDENT STATE
      // -------------------------------------------------

      if (setIncidents) {
        setIncidents((previous) =>
          previous.map((item) =>
            String(
              item.dbId || item.databaseId || item.id
            ) === String(dbId)
              ? {
                  ...item,
                  status: finalStatus,
                  assigned_unit_id: null,
                  outcome,
                  outcome_remarks: remarks,
                  outcome_recorded_at: recordedAt,
                  updated_at: recordedAt,
                }
              : item
          )
        );
      }

      setSelectedIncident(null);

      setOutcomeForm({
        outcome: "",
        remarks: "",
      });

      alert(
        `Incident outcome successfully recorded. Final status: ${finalStatus}. The vehicle has been released.`
      );

      if (onRefresh) {
        await onRefresh();
      }
    } catch (error) {
      console.error("Failed to record incident outcome:", error);

      alert(`Could not save incident outcome: ${error.message}`);
    } finally {
      setSavingOutcome(false);
    }
  }

  // =====================================================
  // CANCEL OUTCOME FORM
  // =====================================================

  function cancelOutcomeForm() {
    if (savingOutcome) return;

    setSelectedIncident(null);

    setOutcomeForm({
      outcome: "",
      remarks: "",
    });
  }

  // =====================================================
  // UI
  // =====================================================

  return (
    <div className="page-content">

      {/* REVIEW NOTIFICATION */}

      {reviewNotice && (
        <div
          className={`review-notification ${reviewNotice.type}`}
          role="status"
        >
          <div className="review-notification-icon">
            {reviewNotice.type === "success" ? "✓" : "!"}
          </div>

          <div className="review-notification-content">
            <strong>{reviewNotice.title}</strong>
            <p>{reviewNotice.message}</p>
          </div>

          <button
            type="button"
            onClick={() => setReviewNotice(null)}
            aria-label="Close notification"
          >
            ×
          </button>
        </div>
      )}

      {/* FINAL OUTCOME VERIFICATION FORM */}

      {selectedIncident && (
        <section className="panel form-panel">
          <div className="panel-heading">
            <div>
              <h3>Verify Final Incident Outcome</h3>

              <p>
                Incident: {getIncidentTitle(selectedIncident)}
              </p>

            </div>
          </div>

          <form
            className="incident-form"
            onSubmit={recordOutcome}
          >
            <label className="full-width">
              Selected incident outcome

              <select
                required
                value={outcomeForm.outcome}
                onChange={(event) =>
                  setOutcomeForm((previous) => ({
                    ...previous,
                    outcome: event.target.value,
                  }))
                }
              >
                <option value="">
                  Select final outcome
                </option>

                {OUTCOMES.map((outcome) => (
                  <option key={outcome} value={outcome}>
                    {outcome}
                  </option>
                ))}
              </select>
            </label>

            {outcomeForm.outcome ===
              "Fire Extinguished by BFP" && (
              <div className="info-note full-width">
                Record that BFP personnel successfully
                extinguished the fire.
              </div>
            )}

            {outcomeForm.outcome ===
              "Extinguished by Residents" && (
              <div className="info-note full-width">
                Record that residents extinguished the fire
                before or upon BFP intervention.
              </div>
            )}

            {outcomeForm.outcome === "False Alarm" && (
              <div className="info-note full-width">
                Record the verification findings explaining
                why no actual fire was found.
              </div>
            )}

            <label className="full-width">
              Verification remarks / observations

              <textarea
                required
                rows={4}
                value={outcomeForm.remarks}
                onChange={(event) =>
                  setOutcomeForm((previous) => ({
                    ...previous,
                    remarks: event.target.value,
                  }))
                }
                placeholder="Enter what the BFP personnel observed and verified..."
              />
            </label>

            <div className="form-actions full-width">
              <button
                type="button"
                className="secondary-button"
                disabled={savingOutcome}
                onClick={cancelOutcomeForm}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="primary-button"
                disabled={savingOutcome}
              >
                <ClipboardCheck size={17} />

                {savingOutcome
                  ? "Saving..."
                  : "Verify & Save Outcome"}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="panel">

        {/* RESCUE REQUEST REVIEW MODAL */}

        {reviewForm && (
          <div className="review-modal-overlay">
            <section
              className="review-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="review-modal-title"
            >
              <div className="review-modal-header">
                <div>
                  <span className="review-modal-label">
                    RESCUE REQUEST REVIEW
                  </span>

                  <h3 id="review-modal-title">
                    {reviewForm.decision === "CONFIRMED"
                      ? "Confirm Rescue Request"
                      : "Reject Rescue Request"}
                  </h3>

                  <p>
                    Review the incident information before proceeding.
                  </p>
                </div>

                <button
                  type="button"
                  className="review-modal-close"
                  onClick={closeReviewForm}
                  disabled={Boolean(savingReviewId)}
                  aria-label="Close review form"
                >
                  ×
                </button>
              </div>

              <form onSubmit={submitReviewForm}>
                <div className="review-modal-body">

                  <div className="review-detail">
                    <span>Incident</span>
                    <strong>
                      {getIncidentTitle(reviewForm.incident)}
                    </strong>
                  </div>

                  <div className="review-detail">
                    <span>Location</span>
                    <strong>
                      {getIncidentLocation(reviewForm.incident)}
                    </strong>
                  </div>

                  <div className="review-detail">
                    <span>Priority</span>
                    <StatusBadge
                      status={getPriority(reviewForm.incident)}
                    />
                  </div>

                  {reviewForm.decision === "CONFIRMED" ? (
                    <div className="review-confirm-notice">
                      You are about to confirm this rescue request.
                      It will become eligible for vehicle dispatch.
                    </div>
                  ) : (
                    <label className="review-reason-field">
                      Reason for rejection

                      <textarea
                        required
                        rows={4}
                        value={reviewReason}
                        onChange={(event) =>
                          setReviewReason(event.target.value)
                        }
                        placeholder="Explain why this rescue request is being rejected..."
                      />
                    </label>
                  )}
                </div>

                <div className="review-modal-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={closeReviewForm}
                    disabled={Boolean(savingReviewId)}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className={
                      reviewForm.decision === "CONFIRMED"
                        ? "primary-button"
                        : "danger-button"
                    }
                    disabled={Boolean(savingReviewId)}
                  >
                    {savingReviewId
                      ? "Processing..."
                      : reviewForm.decision === "CONFIRMED"
                        ? "Confirm Request"
                        : "Reject Request"}
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}

        {/* INCIDENT RECORDS HEADER */}

        <div className="panel-heading responsive-heading">
          <div>
            <h3>Incident Records</h3>

            <p>
              Showing {filtered.length} unresolved incident
              {filtered.length === 1 ? "" : "s"}.
            </p>
          </div>

          <div className="incident-toolbar">
            <div className="search-field">
              <Search size={17} />

              <input
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search incidents..."
                aria-label="Search incidents"
              />
            </div>
          </div>
        </div>

        {/* INCIDENT TABLE */}

        <div className="table-wrapper">
          <table className="fire-incidents-table">
            <thead>
              <tr>
                <th>Incident</th>
                <th>Location</th>
                <th>Priority</th>
                <th>Status / Final Outcome</th>
                <th>Rescue Request</th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((incident, index) => {
                const reviewStatus =
                  incident?.review_status || "PENDING";

                const isPendingReview =
                  reviewStatus === "PENDING" &&
                  ![
                    "Resolved",
                    "False Alarm",
                    "Completed",
                    "Cancelled",
                  ].includes(incident?.status);

                const canSelectOutcome =
                  canRecordOutcome(incident);

                const dbId = getDatabaseId(incident);

                const isSavingReview =
                  Boolean(dbId) && savingReviewId === dbId;

                return (
                  <tr key={incident?.id || index}>

                    {/* INCIDENT */}

                    <td>{getIncidentTitle(incident)}</td>

                    {/* LOCATION */}

                    <td>{getIncidentLocation(incident)}</td>

                    {/* PRIORITY */}

                    <td>
                      <StatusBadge
                        status={getPriority(incident)}
                      />
                    </td>

                    {/* STATUS / FINAL OUTCOME */}

                    <td>
                      <div className="incident-status-control">
                        {canSelectOutcome && (
                          <select
                            aria-label={`Select final outcome for ${getIncidentTitle(incident)}`}
                            value=""
                            disabled={
                              savingOutcome &&
                              selectedIncident?.id === incident?.id
                            }
                            onChange={(event) => {
                              const outcome = event.target.value;

                              if (outcome) {
                                openOutcomeForm(
                                  incident,
                                  outcome
                                );
                              }
                            }}
                          >
                            <option value="">
                              Select final outcome
                            </option>

                            {OUTCOMES.map((outcome) => (
                              <option
                                key={outcome}
                                value={outcome}
                              >
                                {outcome}
                              </option>
                            ))}
                          </select>
                        )}

                        {FINAL_STATUSES.includes(
                          incident?.status
                        ) &&
                          incident?.outcome && (
                            <span className="info-note">
                              {incident.outcome}
                            </span>
                          )}
                      </div>
                    </td>

                    {/* RESCUE REQUEST REVIEW */}

                    <td className="rescue-request-cell">
                      {isPendingReview ? (
                        <div className="rescue-request-actions">
                          <button
                            type="button"
                            className="primary-button"
                            disabled={isSavingReview}
                            onClick={() =>
                              openReviewForm(
                                incident,
                                "CONFIRMED"
                              )
                            }
                          >
                            {isSavingReview
                              ? "Saving..."
                              : "Confirm Request"}
                          </button>

                          <button
                            type="button"
                            className="secondary-button"
                            disabled={isSavingReview}
                            onClick={() =>
                              openReviewForm(
                                incident,
                                "REJECTED"
                              )
                            }
                          >
                            Reject
                          </button>
                        </div>
                      ) : reviewStatus === "REJECTED" ? (
                        <div>
                          <StatusBadge status="REJECTED" />

                          {incident?.review_reason && (
                            <p className="info-note">
                              Reason: {incident.review_reason}
                            </p>
                          )}
                        </div>
                      ) : reviewStatus === "CONFIRMED" ? (
                        <StatusBadge status="CONFIRMED" />
                      ) : (
                        <span>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div className="empty-state">
              {search.trim()
                ? "No incidents match your search."
                : "No unresolved incidents found."}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
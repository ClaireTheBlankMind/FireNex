
import { supabase } from "../lib/supabase";

// Convert database field names into the format your existing
// React dashboard already uses.

function mapIncident(row) {
  return {
    ...row,
    id: row.incident_code,
    dbId: row.id,
    lat: row.latitude,
    lng: row.longitude,
    reportedAt: row.reported_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    senderId: row.sender_id,
    isTest: row.is_test,
  };
}

function mapSensor(row) {
  return {
    ...row,
    id: row.sensor_code,
    dbId: row.id,
    lat: row.latitude,
    lng: row.longitude,
    hardwareConnected: row.hardware_connected,
    lastSeenAt: row.last_seen_at,
    updatedAt: row.updated_at,
  };
}

function mapUnit(row) {
  return {
    ...row,
    id: row.unit_code,
    dbId: row.id,
    lat: row.latitude,
    lng: row.longitude,
    gpsUpdatedAt: row.gps_updated_at,
    locationSource: row.location_source,
    updatedAt: row.updated_at,
  };
}

export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();

  if (error) throw error;

  return data.user;
}

export async function getMyProfile() {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("Please sign in first.");
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, role, created_at")
    .eq("id", user.id)
    .single();

  if (error) throw error;

  return data;
}

export async function listIncidents() {
  const { data, error } = await supabase
    .from("incidents")
    .select("*")
    .order("reported_at", { ascending: false });

  if (error) throw error;

  return data.map(mapIncident);
}

export async function listSensors() {
  const { data, error } = await supabase
    .from("sensors")
    .select("*")
    .order("sensor_code");

  if (error) throw error;

  return data.map(mapSensor);
}

export async function listUnits() {
  const { data, error } = await supabase
    .from("units")
    .select("*")
    .order("unit_code");

  if (error) throw error;

  return data.map(mapUnit);
}

// Create a genuine authenticated incident report.
// Coordinates are optional, but validate them when supplied.
export async function createIncident(input) {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("Please sign in before reporting an incident.");
  }

  const hasCoordinates =
    input.lat != null && input.lng != null;

  if (
    hasCoordinates &&
    (
      !Number.isFinite(Number(input.lat)) ||
      !Number.isFinite(Number(input.lng)) ||
      Number(input.lat) < -90 ||
      Number(input.lat) > 90 ||
      Number(input.lng) < -180 ||
      Number(input.lng) > 180
    )
  ) {
    throw new Error("The incident coordinates are invalid.");
  }

  const payload = {
    title: input.title,
    description: input.description || null,
    location: input.location || null,
    barangay: input.barangay || null,
    latitude: hasCoordinates ? Number(input.lat) : null,
    longitude: hasCoordinates ? Number(input.lng) : null,
    severity: input.severity || "Medium",
    source: input.source || "Resident Report",
    sender_id: user.id,
    status: "Reported",
    is_test: Boolean(input.isTest),
  };

  if (!payload.title?.trim()) {
    throw new Error("An incident title is required.");
  }

  const { data, error } = await supabase
    .from("incidents")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw error;

  return mapIncident(data);
}

// Only BFP operators and administrators can successfully update
// incident status under the database policies.
export async function updateIncidentStatus(
  incidentDbId,
  nextStatus
) {
  const allowedStatuses = [
    "Reported",
    "Confirmed",
    "Dispatched",
    "Resolved",
  ];

  if (!allowedStatuses.includes(nextStatus)) {
    throw new Error("Invalid incident status.");
  }

  const { data, error } = await supabase
    .from("incidents")
    .update({ status: nextStatus })
    .eq("id", incidentDbId)
    .select("*")
    .single();

  if (error) throw error;

  return mapIncident(data);
}

// Atomic database operation: assignment and status updates
// are performed together by the PostgreSQL function.
export async function assignUnitToIncident(
  incidentDbId,
  unitDbId,
  notes = null
) {
  const { data, error } = await supabase.rpc(
    "assign_unit_to_incident",
    {
      p_incident_id: incidentDbId,
      p_unit_id: unitDbId,
      p_notes: notes,
    }
  );

  if (error) throw error;

  return data;
}

// Subscribe to cloud changes.
// Call the returned cleanup function when the page unmounts.
export function subscribeToOperationalChanges(onChange) {
  const channel = supabase
    .channel("FireNex-operational-changes")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "incidents",
      },
      () => onChange("incidents")
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "sensors",
      },
      () => onChange("sensors")
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "units",
      },
      () => onChange("units")
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "dispatch_assignments",
      },
      () => onChange("dispatch_assignments")
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

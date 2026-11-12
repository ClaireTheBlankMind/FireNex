
import { useCallback, useEffect, useState } from "react";
import { supabase } from "./lib/supabase.js";
import {
  initDB,
  saveDataToTable,
  getDataFromTable,
  addToSyncQueue,
  getSyncQueue,
  removeFromSyncQueue,
} from "./lib/db.js";

import Sidebar from "./components/Sidebar";
import Header from "./components/Header";

import LiveOperationsMap from "./pages/LiveOperationsMap";
import IoTMonitoring from "./pages/IoTMonitoring";
import FireIncidents from "./pages/FireIncidents";
import DispatchUnits from "./pages/DispatchUnits";
import IncidentHistory from "./pages/IncidentHistory";
import ReportsAnalytics from "./pages/ReportsAnalytics";
import SystemLog from "./pages/SystemLog";
import AdminAccountControl from "./pages/AdminAccountControl";

import MyProfile from "./pages/MyProfile";
import AccountSettings from "./pages/AccountSettings";
import SecurityPage from "./pages/SecurityPage";
import HelpSupport from "./pages/HelpSupport";

export default function App({ profile, onSignOut }) {
  const [activePage, setActivePage] = useState("Live Operations Map");
  const [mobileOpen, setMobileOpen] = useState(false);

  // Online data from Supabase only.
  const [sensors, setSensors] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [units, setUnits] = useState([]);

  const [sensorLoading, setSensorLoading] = useState(false);
  const [sensorError, setSensorError] = useState("");

  const [dispatchLoading, setDispatchLoading] = useState(false);
  const [dispatchError, setDispatchError] = useState("");
  const [dispatchNotice, setDispatchNotice] = useState("");

  // Load the latest IoT reading for each sensor.
    
const fetchSensorReadings = useCallback(async () => {
  setSensorLoading(true);
  setSensorError("");

  try {
    // First, try to retrieve the latest sensor readings from Supabase.
    const { data, error } = await supabase
      .from("sensor_readings")
      .select(
        "id, sensor_id, smoke_level, temperature_c, alert_status, latitude, longitude, recorded_at"
      )
      .order("recorded_at", { ascending: false });

    if (error) throw error;

    // Keep only the latest reading for each sensor.
    const latestBySensor = new Map();

    for (const reading of data ?? []) {
      if (!latestBySensor.has(reading.sensor_id)) {
        latestBySensor.set(reading.sensor_id, {
          id: reading.sensor_id,
          sensor_id: reading.sensor_id,
          barangay: "",
          smoke: reading.smoke_level,
          temperature: reading.temperature_c,
          status: reading.alert_status,
          latitude: reading.latitude,
          longitude: reading.longitude,
          lastUpdate: reading.recorded_at,
        });
      }
    }

    const sensorArray = Array.from(latestBySensor.values());

    // Display the latest server data.
    setSensors(sensorArray);

    // Save the successful server response to IndexedDB.
    await saveDataToTable("sensors", sensorArray);

    console.log(
      "Loaded IoT sensors from Supabase:",
      sensorArray.length
    );

  } catch (error) {
    console.warn(
      "Supabase sensor request failed. Loading IndexedDB cache:",
      error.message
    );

    try {
      // IndexedDB retrieval is asynchronous.
      const cachedSensors = await getDataFromTable("sensors");

      if (cachedSensors.length > 0) {
        setSensors(cachedSensors);
        console.log(
          "Loaded IoT sensors from IndexedDB:",
          cachedSensors.length
        );
      } else {
        setSensorError(
          "No internet connection and no cached sensor data is available."
        );
      }
    } catch (cacheError) {
      console.error("Failed to load sensor cache:", cacheError);

      setSensorError("Unable to load cached sensor data.");
    }
  } finally {
    setSensorLoading(false);
  }
}, []);

  // Save new incidents directly to Supabase.
  
const saveIncidentToSupabase = useCallback(async (incident) => {
  // Prepare the data that will eventually be inserted into Supabase.
  const incidentPayload = {
    reference_no: incident.reference_no,
    description:
      incident.description ||
      incident.title ||
      "Fire emergency",
    barangay: incident.barangay || null,
    priority: incident.priority || "Medium",
    status: "Reported",
    reporter_name: incident.reporter_name || null,
    contact_number: incident.contact_number || null,
    address: incident.address || incident.location || null,
    latitude: incident.latitude ?? null,
    longitude: incident.longitude ?? null,
  };

  // Save an incident locally and add it to the synchronization queue.
  const saveLocally = async () => {
    const localId = `local_${crypto.randomUUID()}`;

    const localIncident = {
      ...incident,
      ...incidentPayload,
      id: localId,
      dbId: localId,
      databaseId: null,
      created_at: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      status: "Reported",
      is_synced: false,
      sync_status: "pending",
    };

    // Preserve existing cached incidents.
    const current = await getDataFromTable("incidents");

    await saveDataToTable("incidents", [
      localIncident,
      ...current,
    ]);

    // Add the upload operation to the persistent sync queue.
    await addToSyncQueue({
      action: "insert",
      table: "incidents",
      local_record_id: localId,
      payload: incidentPayload,
    });

    // Update the application immediately.
    setIncidents((prev) => [
      localIncident,
      ...prev.filter(
        (item) => String(item.id) !== String(localId)
      ),
    ]);

    console.log("Incident saved locally and added to sync queue:", localId);

    return localIncident;
  };

  // If the device is already offline, save locally.
  if (!navigator.onLine) {
    console.log("Device offline. Saving incident to IndexedDB.");
    return await saveLocally();
  }

  try {
    // Attempt to save directly to Supabase.
    const { data, error } = await supabase
      .from("incidents")
      .insert(incidentPayload)
      .select("*")
      .single();

    if (error) {
      console.error("Supabase rejected incident:", error);
      throw error;
    }

    console.log("Incident successfully saved to Supabase:", data.id);

    return {
      ...data,
      dbId: data.id,
      databaseId: data.id,
      is_synced: true,
      sync_status: "synced",
    };

  } catch (error) {
    // Only queue network-related failures.
    // Do not silently queue permission, validation, or database errors.
    const isNetworkFailure =
      !navigator.onLine ||
      error instanceof TypeError ||
      error?.name === "AbortError" ||
      error?.message?.toLowerCase().includes("fetch");

    if (isNetworkFailure) {
      console.warn(
        "Supabase is unreachable. Saving incident for later synchronization:",
        error.message
      );

      return await saveLocally();
    }

    console.error("Failed to save incident to Supabase:", error);
    throw error;
  }
}, []);

  // Load incidents and response units directly from Supabase.
     
const fetchDispatchData = useCallback(async () => {
  setDispatchLoading(true);
  setDispatchError("");
  setDispatchNotice("");

  try {
    // Retrieve the latest data from Supabase.
    const [incidentResult, unitResult] = await Promise.all([
      supabase
        .from("incidents")
        .select("*")
        .order("created_at", { ascending: false }),

      supabase
        .from("response_units")
        .select(
          "id, unit_name, vehicle_type, status, active, latitude, longitude, last_location_at, created_at"
        )
        .order("created_at", { ascending: true }),
    ]);

    if (incidentResult.error) {
      throw new Error(
        `Could not load incidents: ${incidentResult.error.message}`
      );
    }

    if (unitResult.error) {
      throw new Error(
        `Could not load response units: ${unitResult.error.message}`
      );
    }

    const incidentRows = incidentResult.data ?? [];
    const unitRows = unitResult.data ?? [];

    // Read existing local incidents before updating the cache.
    const cachedIncidents = await getDataFromTable("incidents");

    // Preserve incidents created offline that haven't synchronized.
    const pendingLocalIncidents = cachedIncidents.filter(
      (incident) => incident.is_synced === false
    );

    const mappedIncidents = incidentRows.map((row) => ({
      ...row,
      id: row.id,
      dbId: row.id,
      databaseId: row.id,
      title:
        row.description?.split("\n")[0] ||
        row.reference_no ||
        "Fire emergency",
      description: row.description || "Fire emergency",
      reference_no: row.reference_no || "",
      barangay: row.barangay || "",
      address: row.address || "",
      location: row.address || row.barangay || "Location unavailable",
      latitude:
        row.latitude == null ? null : Number(row.latitude),
      longitude:
        row.longitude == null ? null : Number(row.longitude),
      lat: row.latitude == null ? null : Number(row.latitude),
      lng: row.longitude == null ? null : Number(row.longitude),
      assignedUnit: row.assigned_unit_id || "",
      assigned_unit_id: row.assigned_unit_id || null,
      status: row.status || "Reported",
      priority: row.priority || "Medium",
      reportedAt: row.created_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      is_synced: true,
    }));

    // Combine server incidents with unsynchronized local incidents.
    // Use IDs to avoid duplicate records.
    const combinedIncidents = [
      ...pendingLocalIncidents,
      ...mappedIncidents,
    ];

    const uniqueIncidents = Array.from(
      new Map(
        combinedIncidents.map((incident) => [
          String(incident.id),
          incident,
        ])
      ).values()
    );

    const mappedUnits = unitRows.map((row) => {
      const assignedIncident = uniqueIncidents.find(
        (incident) =>
          String(incident.assigned_unit_id || "") === String(row.id) &&
          !["Resolved", "Completed", "Cancelled"].includes(
            String(incident.status)
          )
      );

      return {
        ...row,
        id: row.id,
        name: row.unit_name || "Unnamed Unit",
        type: row.vehicle_type || "Response Unit",
        status: row.status || "Available",
        active: row.active ?? true,
        lat: row.latitude == null ? null : Number(row.latitude),
        lng: row.longitude == null ? null : Number(row.longitude),
        latitude: row.latitude == null ? null : Number(row.latitude),
        longitude: row.longitude == null ? null : Number(row.longitude),
        last_location_at: row.last_location_at || null,
        assignedIncident: assignedIncident?.id || "",
      };
    });

    // Update the application.
    setIncidents(uniqueIncidents);
    setUnits(mappedUnits);

    // Save the combined incidents and latest units to IndexedDB.
    await Promise.all([
      saveDataToTable("incidents", uniqueIncidents),
      saveDataToTable("units", mappedUnits),
    ]);

    console.log(
      "Supabase dispatch data loaded and cached to IndexedDB."
    );

    console.log(
      `Loaded ${mappedIncidents.length} server incidents and preserved ${pendingLocalIncidents.length} pending local incidents.`
    );

  } catch (error) {
    console.warn(
      "Supabase dispatch request failed. Loading IndexedDB cache:",
      error.message
    );

    try {
      // IndexedDB retrieval is asynchronous.
      const [cachedIncidents, cachedUnits] = await Promise.all([
        getDataFromTable("incidents"),
        getDataFromTable("units"),
      ]);

      if (cachedIncidents.length > 0 || cachedUnits.length > 0) {
        setIncidents(cachedIncidents);
        setUnits(cachedUnits);

        console.log(
          `Loaded ${cachedIncidents.length} incidents and ${cachedUnits.length} units from IndexedDB.`
        );
      } else {
        setDispatchError(
          "No internet connection and no cached dispatch data is available."
        );
      }
    } catch (cacheError) {
      console.error(
        "Failed to load dispatch data from IndexedDB:",
        cacheError
      );

      setDispatchError("Unable to load cached dispatch data.");
    }
  } finally {
    setDispatchLoading(false);
  }
}, []);

  
// Initialize IndexedDB and load application data.
useEffect(() => {
  let cancelled = false;

  async function initializeApp() {
    try {
      // Initialize local offline storage first.
      await initDB();

      if (cancelled) return;

      console.log("FireNex IndexedDB is ready.");

    } catch (error) {
      console.error(
        "FireNex IndexedDB initialization failed:",
        error
      );

      if (!cancelled) {
        setSensorError("Local sensor storage is unavailable.");
        setDispatchError("Local dispatch storage is unavailable.");
      }

      return;
    }

    try {
      // Check the Supabase authentication session.
      const { data, error } = await supabase.auth.getSession();

      if (error) throw error;

      if (!cancelled) {
        console.log("Supabase connection check completed.");
        console.log(
          "User logged in:",
          Boolean(data.session?.user)
        );
      }

    } catch (error) {
      if (!cancelled) {
        console.warn(
          "Supabase connection check failed:",
          error.message
        );
      }
    }

    if (!cancelled) {
      // Load server data or fall back to IndexedDB.
      await Promise.all([
        fetchSensorReadings(),
        fetchDispatchData(),
      ]);
    }
  }

  initializeApp();

  return () => {
    cancelled = true;
  };
}, [fetchSensorReadings, fetchDispatchData]);

  // Automatically refresh incidents when Supabase records change.
  useEffect(() => {
    const channel = supabase
      .channel("live-incident-updates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "incidents",
        },
        () => {
          fetchDispatchData();
        }
      )
      .subscribe((status) => {
        console.log("Incident realtime status:", status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchDispatchData]);

  // Display the selected dashboard or account page.
  function renderPage() {
    switch (activePage) {
      case "Live Operations Map":
        return (
          <LiveOperationsMap
            sensors={sensors}
            incidents={incidents}
            units={units}
            setIncidents={setIncidents}
            sensorLoading={sensorLoading}
            sensorError={sensorError}
            dispatchLoading={dispatchLoading}
            dispatchError={dispatchError}
            onRefresh={async () => {
              await Promise.all([
                fetchSensorReadings(),
                fetchDispatchData(),
              ]);
            }}
            onOpenIncidents={() =>
              setActivePage("Fire Incidents")
            }
          />
        );

      case "IoT Monitoring":
        return (
          <IoTMonitoring
            sensors={sensors}
            loading={sensorLoading}
            error={sensorError}
            onRefresh={fetchSensorReadings}
          />
        );

      case "Fire Incidents":
        return (
          <FireIncidents
            incidents={incidents}
            setIncidents={setIncidents}
            saveIncidentToSupabase={saveIncidentToSupabase}
            onRefresh={fetchDispatchData}
          />
        );

      case "Dispatch Units":
        return (
          <DispatchUnits
            profile={profile}
            units={units}
            setUnits={setUnits}
            incidents={incidents}
            setIncidents={setIncidents}
            loading={dispatchLoading}
            loadError={dispatchError}
            notice={dispatchNotice}
            onRefresh={fetchDispatchData}
          />
        );

      case "Incident History":
        return <IncidentHistory incidents={incidents} />;

      case "Reports & Analytics":
        return (
          <ReportsAnalytics
            incidents={incidents}
            sensors={sensors}
            units={units}
          />
        );

      case "System Log":
        return profile?.role === "superadmin" &&
          profile?.active === true ? (
          <SystemLog />
        ) : (
          <LiveOperationsMap
            sensors={sensors}
            incidents={incidents}
            units={units}
            setIncidents={setIncidents}
            onOpenIncidents={() =>
              setActivePage("Fire Incidents")
            }
          />
        );

      case "Admin Account Control & Approval":
        return profile?.role === "superadmin" &&
          profile?.active === true ? (
          <AdminAccountControl profile={profile} />
        ) : (
          <LiveOperationsMap
            sensors={sensors}
            incidents={incidents}
            units={units}
            setIncidents={setIncidents}
            onOpenIncidents={() =>
              setActivePage("Fire Incidents")
            }
          />
        );

      case "My Profile":
        return (
          <MyProfile
            onBack={() =>
              setActivePage("Live Operations Map")
            }
          />
        );

      case "Account Settings":
        return (
          <AccountSettings
            onBack={() =>
              setActivePage("Live Operations Map")
            }
          />
        );

      case "Security":
        return (
          <SecurityPage
            onBack={() =>
              setActivePage("Live Operations Map")
            }
          />
        );

      case "Help & Support":
        return (
          <HelpSupport
            onBack={() =>
              setActivePage("Live Operations Map")
            }
          />
        );

      default:
        return (
          <LiveOperationsMap
            sensors={sensors}
            incidents={incidents}
            units={units}
            setIncidents={setIncidents}
            onOpenIncidents={() =>
              setActivePage("Fire Incidents")
            }
          />
        );
    }
  }

  return (
    <div className="app-layout">
      <Sidebar
        profile={profile}
        activePage={activePage}
        setActivePage={setActivePage}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />

      <main className="main-content">
        <Header
          title={activePage}
          onMenuClick={() => setMobileOpen(true)}
          sensors={sensors}
          incidents={incidents}
          units={units}
          onNavigate={setActivePage}
          onSignOut={onSignOut}
        />

        <div className="page-container">
          {renderPage()}
        </div>

        <footer className="app-footer">
          <span>
            FireNex · Emergency Reporting &amp; Response Monitoring
          </span>
        </footer>
      </main>
    </div>
  );
}

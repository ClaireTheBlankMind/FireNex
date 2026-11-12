
import { useCallback, useEffect, useState } from "react";
import { supabase } from "./lib/supabase.js";
import { initDB, saveDataToTable, getDataFromTable } from "./lib/db.js"; // NEW

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
      if (!navigator.onLine) {
        console.log("Offline: Loading sensors from SQLite");
        const cachedSensors = getDataFromTable('sensors');
        setSensors(cachedSensors);
        return;
      }

      const { data, error } = await supabase
        .from("sensor_readings")
        .select(
          "id, sensor_id, smoke_level, temperature_c, alert_status, latitude, longitude, recorded_at"
        )
        .order("recorded_at", { ascending: false });

      if (error) throw error;

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
      setSensors(sensorArray);
      
      // Save to SQLite for offline use
      saveDataToTable('sensors', sensorArray);

      console.log("Loaded IoT sensors:", latestBySensor.size);
    } catch (error) {
      console.error("Failed to load IoT sensor readings:", error);
      setSensorError(error.message || "Failed to load sensor readings.");
    } finally {
      setSensorLoading(false);
    }
  }, []);

  // Save new incidents directly to Supabase.
  const saveIncidentToSupabase = useCallback(async (incident) => {

        // OFFLINE FALLBACK
    if (!navigator.onLine) {
      console.log("Offline: Saving incident to local SQLite.");
      const localIncident = {
        ...incident,
        id: `local_${Date.now()}`,
        dbId: `local_${Date.now()}`,
        created_at: new Date().toISOString(),
        status: "Reported",
        is_synced: false // We will use this later to sync
      };
      
      // Get current local incidents, add the new one, and save
      const current = getDataFromTable('incidents');
      saveDataToTable('incidents', [localIncident, ...current]);
      
      // Update UI
      setIncidents(prev => [localIncident, ...prev]);
      
      return localIncident;
    }

    const { data, error } = await supabase
      .from("incidents")
      .insert({
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
      })
      .select("*")
      .single();

    if (error) {
      console.error("Failed to save incident:", error);
      throw error;
    }

    return data;
  }, []);

  // Load incidents and response units directly from Supabase.
    const fetchDispatchData = useCallback(async () => {
    setDispatchLoading(true);
    setDispatchError("");
    setDispatchNotice("");

    try {
      if (!navigator.onLine) {
        console.log("Offline: Loading dispatch data from SQLite");
        setIncidents(getDataFromTable('incidents'));
        setUnits(getDataFromTable('units'));
        return;
      }

      const [incidentResult, unitResult] = await Promise.all([
        supabase.from("incidents").select("*").order("created_at", { ascending: false }),
        supabase.from("response_units").select("id, unit_name, vehicle_type, status, active, latitude, longitude, last_location_at, created_at").order("created_at", { ascending: true }),
      ]);

      if (incidentResult.error) throw new Error(`Could not load incidents: ${incidentResult.error.message}`);
      if (unitResult.error) throw new Error(`Could not load response units: ${unitResult.error.message}`);

      const incidentRows = incidentResult.data ?? [];
      const unitRows = unitResult.data ?? [];

      const mappedIncidents = incidentRows.map((row) => ({
        ...row,
        id: row.id,
        dbId: row.id,
        databaseId: row.id,
        title: row.description?.split("\n")[0] || row.reference_no || "Fire emergency",
        description: row.description || "Fire emergency",
        reference_no: row.reference_no || "",
        barangay: row.barangay || "",
        address: row.address || "",
        location: row.address || row.barangay || "Location unavailable",
        latitude: row.latitude == null ? null : Number(row.latitude),
        longitude: row.longitude == null ? null : Number(row.longitude),
        lat: row.latitude == null ? null : Number(row.latitude),
        lng: row.longitude == null ? null : Number(row.longitude),
        assignedUnit: row.assigned_unit_id || "",
        assigned_unit_id: row.assigned_unit_id || null,
        status: row.status || "Reported",
        priority: row.priority || "Medium",
        reportedAt: row.created_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));

      const mappedUnits = unitRows.map((row) => {
        const assignedIncident = mappedIncidents.find(
          (incident) =>
            String(incident.assigned_unit_id || "") === String(row.id) &&
            !["Resolved", "Completed", "Cancelled"].includes(String(incident.status))
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

      setIncidents(mappedIncidents);
      setUnits(mappedUnits);

      // Save to SQLite for offline use
      saveDataToTable('incidents', mappedIncidents);
      saveDataToTable('units', mappedUnits);

      console.log("Supabase dispatch data loaded and cached.");

      if (mappedUnits.length === 0) {
        setDispatchNotice("No response units are visible to this query.");
      }
    } catch (error) {
      console.error("Failed to load dispatch data:", error);
      setDispatchError(error.message || "Could not load dispatch data.");
    } finally {
      setDispatchLoading(false);
    }
  }, []);

  // Initialize the application and load online data.
  useEffect(() => {
    let cancelled = false;

    async function initializeApp() {
      // Initialize SQLite FIRST
      await initDB();
      
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!cancelled) {
          console.log("Supabase client is responding.");
          console.log("User logged in:", Boolean(data.session?.user));
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Supabase connection check failed:", error.message);
        }
      }

      if (!cancelled) {
        // This will now check navigator.onLine and use SQLite if needed
        await Promise.all([fetchSensorReadings(), fetchDispatchData()]);
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

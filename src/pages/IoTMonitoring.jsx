
import { useState } from "react";
import { RadioTower, Search } from "lucide-react";
import { BARANGAYS } from "../data/barangays";
import StatCard from "../components/StatCard";
import StatusBadge from "../components/StatusBadge";

export default function IoTMonitoring({
  sensors = [],
  loading = false,
  error = "",
  onRefresh,
}) {
  const [search, setSearch] = useState("");
  const [selectedBarangay, setSelectedBarangay] = useState("");

  const filtered = sensors.filter((sensor) => {
    const matchesSearch = `${sensor.barangay || ""} ${
      sensor.status || ""
    }`
      .toLowerCase()
      .includes(search.toLowerCase());

    const matchesBarangay =
      !selectedBarangay || sensor.barangay === selectedBarangay;

    return matchesSearch && matchesBarangay;
  });

  const normalCount = sensors.filter(
    (sensor) => sensor.status === "Normal"
  ).length;

  const warningCount = sensors.filter(
    (sensor) => sensor.status === "Warning"
  ).length;

  const criticalCount = sensors.filter(
    (sensor) => sensor.status === "Critical"
  ).length;

  function formatLastUpdate(value) {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "—";

    return date.toLocaleString();
  }

  return (
    <div className="page-content">
      <div className="stats-grid">
        <StatCard
          label="Connected Sensors"
          value={sensors.length}
          detail="Sensors registered in the system"
          icon={RadioTower}
          tone="blue"
        />

        <StatCard
          label="Normal"
          value={normalCount}
          detail="Reporting normal readings"
          icon={RadioTower}
          tone="green"
        />

        <StatCard
          label="Warnings"
          value={warningCount}
          detail="Readings need attention"
          icon={RadioTower}
          tone="orange"
        />

        <StatCard
          label="Critical"
          value={criticalCount}
          detail="Critical sensor status"
          icon={RadioTower}
          tone="red"
        />
      </div>

      <section className="panel">
        <div className="panel-heading responsive-heading">
          <div className="search-field">
            <Search size={20} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search barangay or status..."
              aria-label="Search sensors"
            />
          </div>

          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh Readings"}
          </button>
        </div>

        <div className="panel-heading responsive-heading">
          <div>
            <label htmlFor="sensor-barangay-filter">
              Filter by barangay
            </label>
          </div>

          <select
            id="sensor-barangay-filter"
            value={selectedBarangay}
            onChange={(event) =>
              setSelectedBarangay(event.target.value)
            }
          >
            <option value="">All barangays</option>

            {BARANGAYS.map((barangay) => (
              <option key={barangay} value={barangay}>
                {barangay}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div className="info-note" role="alert">
            Could not load sensor readings: {error}
          </div>
        )}

        {loading && (
          <div className="info-note" role="status">
            Loading sensor readings from Supabase...
          </div>
        )}

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Barangay</th>
                <th>GPS Coordinates</th>
                <th>Temperature</th>
                <th>Smoke Reading</th>
                <th>Status</th>
                <th>Last Update</th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((sensor, index) => (
                <tr key={index}>
                  <td>{sensor.barangay || "Unassigned"}</td>

                  <td>
                    {sensor.latitude != null &&
                    sensor.longitude != null
                      ? `${sensor.latitude}, ${sensor.longitude}`
                      : "Location unavailable"}
                  </td>

                  <td>
                    {sensor.temperature ?? "—"}
                  </td>

                  <td>
                    {sensor.smoke ?? "—"}
                  </td>

                  <td>
                    {sensor.status ? (
                      <StatusBadge status={sensor.status} />
                    ) : (
                      "Unknown"
                    )}
                  </td>

                  <td>
                    {formatLastUpdate(sensor.lastUpdate)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div className="empty-state">
              {sensors.length === 0
                ? "No IoT sensors are connected or registered yet. Sensor readings will appear when the hardware integration is configured."
                : "No sensors match your search or selected barangay."}
            </div>
          )}
        </div>

        <div className="info-note">
          Live monitoring requires compatible IoT hardware and a
          configured communication service. This page displays
          the sensor readings supplied by the application.
        </div>
      </section>
    </div>
  );
}

import { Fragment, useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Circle,
  Polyline,
  GeoJSON,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import pointOnFeature from "@turf/point-on-feature";

import {
  RadioTower,
  Flame,
} from "lucide-react";

import StatusBadge from "../components/StatusBadge";
import { supabase } from "../lib/supabase.js";

// Verified BFP Hide-out coordinates.
const DEMO_BFP_ORIGIN = [7.7944583, 123.7193828];

// Barangays for the simulated sender buttons.
// Coordinates will be calculated from the GeoJSON polygons.
const SENDER_BARANGAYS = [
  { id: "RES-001", name: "Test Sender 1", barangay: "Bangaan" },
  { id: "RES-002", name: "Test Sender 2", barangay: "Poblacion" },
  { id: "RES-003", name: "Test Sender 3", barangay: "Mina" },
];

// Marker icons
const sensorIcon = L.divIcon({
  className: "map-marker-wrapper",
  html: '<div class="map-marker sensor-marker">S</div>',
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

const unitIcon = L.divIcon({
  className: "map-marker-wrapper",
  html: '<div class="map-marker unit-marker">T</div>',
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

function getIncidentIcon(status) {
  const colors = {
    Reported: "#dc2626",
    Responding: "#2563eb",
    Rejected: "#6b7280",
    Completed: "#16a34a",
    Resolved: "#16a34a",
  };

  const color = colors[status] || "#dc2626";

  return L.divIcon({
    className: "map-marker-wrapper",
    html: `
      <div class="map-marker incident-marker"
        style="background:${color};border:2px solid white;">
        !
      </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}

function isSultanNagaDimaporoBarangay(feature) {
  const properties = feature?.properties || {};

  return (
    properties.level === "barangay" &&
    String(properties.municity_psgc) === "1003506000"
  );
}

function normalizeBarangayName(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

// Draw the municipality's barangay polygons and fit the map to them.
function BarangayBoundaryLayer({ municipalityData }) {
  const map = useMap();

  useEffect(() => {
    if (!municipalityData?.features?.length) return;

    const boundaryLayer = L.geoJSON(municipalityData);
    const bounds = boundaryLayer.getBounds();

    if (bounds.isValid()) {
      const municipalBounds = bounds.pad(0.02);

      map.fitBounds(municipalBounds, {
        padding: [5, 5],
        maxZoom: 13,
        animate: false,
      });

      map.setMaxBounds(municipalBounds);
      map.setMinZoom(10);
    }
  }, [municipalityData, map]);

  if (!municipalityData?.features?.length) return null;

  return (
    <GeoJSON
      data={municipalityData}
      style={() => ({
        color: "#16764a",
        weight: 2,
        opacity: 0.9,
        fillColor: "#54b889",
        fillOpacity: 0.08,
      })}
      onEachFeature={(feature, layer) => {
        const name =
          feature.properties?.name || "Unknown Barangay";

        // Display the name only when the polygon is clicked.
        layer.bindPopup(`
          <div class="barangay-popup">
            <strong>${name}</strong><br />
            <span>Sultan Naga Dimaporo, Lanao del Norte</span>
          </div>
        `);

        layer.on({
          mouseover: (event) => {
            event.target.setStyle({
              weight: 4,
              color: "#0b5d3b",
              fillColor: "#36b37e",
              fillOpacity: 0.3,
            });

            event.target.bringToFront();
          },

          mouseout: (event) => {
            event.target.setStyle({
              weight: 2,
              color: "#16764a",
              fillColor: "#54b889",
              fillOpacity: 0.08,
            });
          },
        });
      }}
    />
  );
}

// Get an interior point from each selected barangay polygon.
function buildSenderLocations(municipalityData) {
  if (!municipalityData?.features?.length) return [];

  return SENDER_BARANGAYS.flatMap((sender) => {
    const feature = municipalityData.features.find(
      (item) =>
        normalizeBarangayName(item.properties?.name) ===
        normalizeBarangayName(sender.barangay)
    );

    if (!feature) {
      console.warn(
        `Barangay "${sender.barangay}" was not found in the GeoJSON file.`
      );
      return [];
    }

    try {
      // Turf returns a point inside the polygon, rather than
      // simply using the center of its bounding box.
      const point = pointOnFeature(feature);
      const coordinates = point.geometry.coordinates;

      // GeoJSON uses [longitude, latitude].
      const lng = Number(coordinates[0]);
      const lat = Number(coordinates[1]);

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return [];
      }

      return [
        {
          ...sender,
          lat,
          lng,
        },
      ];
    } catch (error) {
      console.error(
        `Could not calculate a point inside ${sender.barangay}:`,
        error
      );
      return [];
    }
  });
}

// Fetch a driving route for confirmed/dispatched incidents.
// Requires internet access and the public OSRM routing service.
function IncidentRoute({ incident, origin }) {
  const [route, setRoute] = useState([]);

  useEffect(() => {
    let cancelled = false;

    const lat = Number(incident.lat);
    const lng = Number(incident.lng);

    if (
      incident.status !== "Responding" ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng)
    ) {
      setRoute([]);
      return undefined;
    }

    setRoute([]);

    const url =
      "https://router.project-osrm.org/route/v1/driving/" +
      `${origin[1]},${origin[0]};${lng},${lat}` +
      "?overview=full&geometries=geojson";

    fetch(url)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Routing service unavailable.");
        }

        return response.json();
      })
      .then((data) => {
        if (cancelled) return;

        const coordinates =
          data.routes?.[0]?.geometry?.coordinates;

        if (!coordinates?.length) {
          console.warn("No driving route was returned.");
          return;
        }

        setRoute(
          coordinates.map(([routeLng, routeLat]) => [
            routeLat,
            routeLng,
          ])
        );
      })
      .catch((error) => {
        if (!cancelled) {
          console.error("Could not load driving route:", error);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    incident.id,
    incident.lat,
    incident.lng,
    incident.status,
    origin,
  ]);

  if (!route.length) return null;

  return (
    <Polyline
      positions={route}
      pathOptions={{
        color: "#2563eb",
        weight: 5,
        opacity: 0.9,
      }}
    />
  );
}

export default function LiveOperationsMap({
  sensors = [],
  incidents = [],
  units = [],
  setIncidents,
  onOpenIncidents,
}) {
  const [boundaryData, setBoundaryData] = useState(null);
  const [boundaryError, setBoundaryError] = useState("");
  const [creatingTestRequest, setCreatingTestRequest] = useState(false);

  // Load barangay boundaries once.
  useEffect(() => {
    let cancelled = false;

    fetch("/maps/sultan_naga_dimaporo_barangays.geojson")
      .then((response) => {
        if (!response.ok) {
          throw new Error(
            "Unable to load the barangay GeoJSON file."
          );
        }

        return response.json();
      })
      .then((data) => {
        if (cancelled) return;

        if (!Array.isArray(data.features)) {
          throw new Error("The GeoJSON file has no features array.");
        }

      //   console.log(
      //   "GeoJSON feature count:",
      //   data.features.length
      // );

      // console.log(
      //   "Example GeoJSON properties:",
      //   data.features.slice(0, 3).map((feature) => feature.properties)
      // );

        const filteredData = {
          ...data,
          features: data.features.filter(
            isSultanNagaDimaporoBarangay
          ),
        };

        if (filteredData.features.length === 0) {
          throw new Error(
            "No barangays matched the municipality PSGC filter. Check the GeoJSON properties."
          );
        }

        setBoundaryData(filteredData);
        setBoundaryError("");
      })
      .catch((error) => {
        if (!cancelled) {
          console.error("Barangay boundary error:", error);
          setBoundaryError(error.message);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Calculate the sender coordinates from the loaded polygons.
  const demoSenders = useMemo(
    () => buildSenderLocations(boundaryData),
    [boundaryData]
  );
  

const incidentsWithMapLocations = useMemo(() => {
  return incidents.map((incident) => {
    const latitude =
      incident.latitude ?? incident.lat;
    const longitude =
      incident.longitude ?? incident.lng;

    const hasLatitude =
      latitude != null && String(latitude).trim() !== "";
    const hasLongitude =
      longitude != null && String(longitude).trim() !== "";

    // Use exact coordinates if both are available and valid.
    if (hasLatitude && hasLongitude) {
      const lat = Number(latitude);
      const lng = Number(longitude);

      if (
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        lat >= -90 &&
        lat <= 90 &&
        lng >= -180 &&
        lng <= 180
      ) {
        return {
          ...incident,
          lat,
          lng,
          locationIsApproximate: false,
        };
      }
    }

    // Otherwise, find the incident's barangay polygon.
    const barangayName = normalizeBarangayName(
      incident.barangay || incident.location
    );

    const feature = boundaryData?.features?.find(
      (item) =>
        normalizeBarangayName(item.properties?.name) ===
        barangayName
    );

    if (!feature) {
      console.warn("Incident could not be placed on map:", {
        id: incident.id,
        reference_no: incident.reference_no,
        barangay: incident.barangay,
        location: incident.location,
        latitude,
        longitude,
      });

      return {
        ...incident,
        lat: null,
        lng: null,
        locationIsApproximate: false,
      };
    }

    try {
      const point = pointOnFeature(feature);
      const [lng, lat] = point.geometry.coordinates;

      return {
        ...incident,
        lat: Number(lat),
        lng: Number(lng),
        locationIsApproximate: true,
      };
    } catch (error) {
      console.error("Could not calculate incident map location:", error);

      return {
        ...incident,
        lat: null,
        lng: null,
        locationIsApproximate: false,
      };
    }
  });
}, [incidents, boundaryData]);

  const activeIncidents = useMemo(
    () =>
      incidents.filter(
        (incident) =>
          !["Resolved", "False Alarm", "Completed", "Cancelled"].includes(
            String(incident.status || "").trim()
          )
      ),
    [incidents]
  );

  const alerts = useMemo(
    () => sensors.filter((sensor) => sensor.status !== "Normal"),
    [sensors]
  );  

async function addTestEmergency(sender) {
  if (creatingTestRequest) return;

  if (typeof setIncidents !== "function") {
    console.error("setIncidents is missing. Pass it from App.jsx.");
    window.alert("Unable to create test rescue request.");
    return;
  }

  setCreatingTestRequest(true);

  try {
    // Get the authenticated Supabase user.
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) throw userError;

    if (!user) {
      throw new Error("Please sign in before creating a test request.");
    }

    const now = new Date().toISOString();
    const referenceNo = `SOS-${Date.now()}-${sender.id}`;

    // Save the simulated incident to Supabase.
    const { data: savedIncident, error: insertError } = await supabase
      .from("incidents")
      .insert({
        reference_no: referenceNo,
        reporter_name: sender.name,
        description:
          "SIMULATED RESCUE REQUEST - Testing only. Do not dispatch.",
        barangay: sender.barangay,
        address: sender.barangay,
        latitude: sender.lat,
        longitude: sender.lng,
        priority: "High",
        status: "Reported",
        created_by: user.id,
      })
      .select("*")
      .single();

    if (insertError) throw insertError;

    if (!savedIncident?.id) {
      throw new Error("Supabase did not return the saved incident ID.");
    }


    // Use the actual Supabase record.
    const incident = {
      id: savedIncident.id,
      dbId: savedIncident.id,
      databaseId: savedIncident.id,

      title: `Rescue Request - ${sender.name}`,
      reference_no: savedIncident.reference_no,

      reporter_name: savedIncident.reporter_name,
      location: savedIncident.barangay,
      barangay: savedIncident.barangay,

      latitude: savedIncident.latitude,
      longitude: savedIncident.longitude,
      lat: Number(savedIncident.latitude),
      lng: Number(savedIncident.longitude),

      severity: savedIncident.priority,
      priority: savedIncident.priority,

      source: "Simulated Resident Request",
      senderId: sender.id,
      senderName: sender.name,

      status: savedIncident.status,
      reportedAt: savedIncident.created_at || now,
      createdAt: savedIncident.created_at || now,
      updatedAt: savedIncident.updated_at || now,

      isTest: true,

      statusHistory: [
        {
          status: "Reported",
          timestamp: savedIncident.created_at || now,
          note: "Simulated rescue request. Do not dispatch.",
        },
      ],
    };

    // Update the dashboard only after successful database insertion.
    setIncidents((previous) => [incident, ...previous]);

    window.alert(
      `Test rescue request saved successfully!\nReference: ${savedIncident.reference_no}`
    );

  } catch (error) {
    console.error("Failed to save simulated rescue request:", error);

    window.alert(
      `Failed to save rescue request:\n${error.message}`
    );

  } finally {
    setCreatingTestRequest(false);
  }
}


  // Update status and keep a history of changes.
function updateIncidentStatus(incidentId, nextStatus) {
  if (typeof setIncidents !== "function") {
    console.error("setIncidents was not provided by App.jsx.");
    return;
  }

  const allowedTransitions = {
    Reported: ["Confirmed"],
    Confirmed: ["Dispatched"],
    Dispatched: ["Resolved"],
    Resolved: [],
  };

  setIncidents((previous) =>
    previous.map((incident) => {
      if (incident.id !== incidentId) return incident;

      if (!allowedTransitions[incident.status]?.includes(nextStatus)) {
        return incident;
      }

      const now = new Date().toISOString();

      return {
        ...incident,
        status: nextStatus,
        updatedAt: now,
        statusHistory: [
          ...(incident.statusHistory || []),
          {
            status: nextStatus,
            timestamp: now,
            note: `Status changed to ${nextStatus}`,
          },
        ],
      };
    })
  );
}

  return (
    <div className="page-content">

      <section className="panel map-page-panel">

        <div className="test-sender-buttons">
          <p><strong>Simulate a rescue request from:</strong></p>

          {boundaryError && (
            <p role="alert">
              Barangay data error: {boundaryError}
            </p>
          )}

          {!boundaryData && !boundaryError && (
            <p>Loading barangay locations…</p>
          )}

          {boundaryData && demoSenders.length === 0 && (
            <p>
              No test sender locations could be created. Check that the
              GeoJSON contains Bangaan, Poblacion, and Mina.
            </p>
          )}

          {demoSenders.map((sender) => (
            <button
              key={sender.id}
              className="text-button"
              disabled={creatingTestRequest}
              onClick={() => addTestEmergency(sender)}
            >
              {creatingTestRequest
                ? "Saving request..."
                : `+ ${sender.name} (${sender.barangay})`}
            </button>
          ))}
        </div>

        <div className="map-container">
          <MapContainer
            center={[7.67, 123.78]}
            zoom={12}
            scrollWheelZoom={true}
            className="leaflet-map"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {boundaryData && (
              <BarangayBoundaryLayer
                municipalityData={boundaryData}
              />
            )}

            {/* IoT sensors and illustrative alert zones */}
            {sensors.map((sensor) => {
              const lat = Number(sensor.lat);
              const lng = Number(sensor.lng);

              if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
                return null;
              }

              const isNormal = sensor.status === "Normal";

              return (
                <Fragment key={sensor.id}>
                  <Circle
                    center={[lat, lng]}
                    radius={isNormal ? 80 : 500}
                    pathOptions={{
                      color: isNormal ? "#159b69" : "#dc3838",
                      fillColor: isNormal ? "#159b69" : "#dc3838",
                      fillOpacity: 0.12,
                      weight: 2,
                    }}
                  />

                  <Marker position={[lat, lng]} icon={sensorIcon}>
                    <Popup>
                      <strong>{sensor.name || sensor.sensor_name || "IoT Sensor"}</strong>
                      <br />
                      Barangay: {sensor.barangay}
                      <br />
                      Temperature: {sensor.temperature}°C
                      <br />
                      Smoke reading: {sensor.smoke}
                      <br />
                      Status: {sensor.status}
                    </Popup>
                  </Marker>
                </Fragment>
              );
            })}

            {/* BFP response units */}
            {units.map((unit) => {
              const lat = Number(unit.lat);
              const lng = Number(unit.lng);

              if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
                return null;
              }

              return (
                <Marker
                  key={unit.id}
                  position={[lat, lng]}
                  icon={unitIcon}
                >
                <Popup>
                  <strong>{unit.name || unit.unit_name || "Response Unit"}</strong>
                  <br />
                  Vehicle: {unit.type || unit.vehicle_type || "Not specified"}
                  <br />
                  Status: {unit.status}
                  <br />
                  Last GPS Update:{" "}
                  {unit.last_location_at
                    ? new Date(unit.last_location_at).toLocaleString()
                    : "No GPS update yet"}
                </Popup>
                </Marker>
              );
            })}

            {/* Emergency markers and navigation routes */}
            {incidentsWithMapLocations.map((incident) => {
              const lat = incident.lat;
              const lng = incident.lng;

              if (
                lat == null ||
                lng == null ||
                !Number.isFinite(lat) ||
                !Number.isFinite(lng)
              ) {
                return null;
              }

              if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
                return null;
              }

              return (
                <Fragment key={incident.id}>
                  {incident.status === "Responding" && (
                    <IncidentRoute
                      incident={incident}
                      origin={DEMO_BFP_ORIGIN}
                    />
                  )}

                  <Marker
                    position={[lat, lng]}
                    icon={getIncidentIcon(incident.status)}
                  >
                    <Popup>
                      <strong>
                        {incident.title || "Fire Incident"}
                      </strong>
                      <br />
                      Reference No.: {incident.reference_no || "Not available"}
                      <br />
                      Reporter: {incident.reporter_name || incident.senderName || "Unknown reporter"}
                      <br />
                      Location: {incident.location || incident.barangay}
                      <br />
                      Severity: {incident.severity || "Unknown"}
                      <br />
                      Status: {incident.status}
                      <br />
                        <strong>
                          {incident.locationIsApproximate
                            ? "Approximate barangay location — GPS unavailable"
                            : "GPS location"}
                        </strong>
                      

                      {incident.isTest && (
                        <>
                          <br />
                          <strong>
                            TEST INCIDENT — NOT A REAL EMERGENCY
                          </strong>
                        </>
                      )}

                      <hr />

                      {incident.status === "Reported" && (
                        <button
                          onClick={() =>
                            updateIncidentStatus(
                              incident.id,
                              "Confirmed"
                            )
                          }
                        >
                          Confirm Emergency
                        </button>
                      )}

                      {incident.status === "Confirmed" && (
                        <button
                          onClick={() =>
                            updateIncidentStatus(
                              incident.id,
                              "Dispatched"
                            )
                          }
                        >
                          Dispatch BFP Unit
                        </button>
                      )}

                      {incident.status === "Dispatched" && (
                        <button
                          onClick={() =>
                            updateIncidentStatus(
                              incident.id,
                              "Resolved"
                            )
                          }
                        >
                          Mark Rescue Complete
                        </button>
                      )}

                      {["Confirmed", "Dispatched"].includes(
                        incident.status
                      ) && (
                        <>
                          <br />
                          <a
                            href={
                              "https://www.google.com/maps/dir/?api=1" +
                              `&origin=${DEMO_BFP_ORIGIN[0]},${DEMO_BFP_ORIGIN[1]}` +
                              `&destination=${lat},${lng}` +
                              "&travelmode=driving"
                            }
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open Navigation
                          </a>
                        </>
                      )}
                    </Popup>
                  </Marker>
                </Fragment>
              );
            })}
          </MapContainer>
        </div>

        <div className="map-legend">
          <span><i className="legend-sensor" /> Sensor</span>
          <span><i className="legend-incident" /> Incident</span>
          <span><i className="legend-unit" /> Response unit</span>
          <span><i className="legend-zone" /> Illustrative zone</span>
        </div>
      </section>

      <div className="two-column-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h3>Sensor Alerts</h3>
              <p>Sensors requiring attention</p>
            </div>
          </div>

          {alerts.length === 0 ? (
            <div className="empty-state">
              No sensor alerts available.
            </div>
          ) : (
            alerts.map((sensor) => (
              <div className="alert-row" key={sensor.id}>
                <div className="alert-icon">
                  <RadioTower size={19} />
                </div>

                <div className="alert-details">
                  <strong>
                    {sensor.name || sensor.sensor_name || "IoT Sensor"} · {sensor.barangay || "Unknown Barangay"}
                  </strong>
                  <span>
                    {sensor.temperature}°C · Smoke reading {sensor.smoke}
                  </span>
                </div>

                <StatusBadge status={sensor.status} />
              </div>
            ))
          )}
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <h3>Active Incidents</h3>
              <p>Unresolved incident records</p>
            </div>

            <button
              className="text-button"
              onClick={onOpenIncidents}
            >
              View incidents →
            </button>
          </div>

          {activeIncidents.length === 0 ? (
            <div className="empty-state">
              No unresolved incidents.
            </div>
          ) : (
            activeIncidents.map((incident) => (
              <div className="alert-row" key={incident.id}>
                <div className="alert-icon alert-icon-red">
                  <Flame size={19} />
                </div>

                <div className="alert-details">
                  <strong>
                    {incident.reference_no || "Incident"} · {incident.title || "Fire Incident"}
                  </strong>
                  <span>
                    {incident.barangay} · {incident.source}
                  </span>
                </div>

                <StatusBadge status={incident.status} />
              </div>
            ))
          )}
        </section>
      </div>
    </div>
  );}

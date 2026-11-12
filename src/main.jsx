import React from "react";
import { createRoot } from "react-dom/client";

import "leaflet/dist/leaflet.css";
import "./index.css";

import App from "./auth/AuthGate.jsx";

const rootElement = document.getElementById("root");

createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

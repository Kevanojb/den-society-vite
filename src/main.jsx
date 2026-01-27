import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import "./legacy.css";         // ✅ THIS is what makes the “special cards” work
import AuthGate from "./AuthGate.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthGate />
  </React.StrictMode>
);

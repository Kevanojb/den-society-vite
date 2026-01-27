import React from "react";
import ReactDOM from "react-dom/client";
import AuthGate from "./AuthGate.jsx";

// ✅ Force App chunk CSS (and any global imports inside App) to be included up-front
import "./App.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthGate />
  </React.StrictMode>
);

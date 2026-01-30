import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import AuthGate from "./AuthGate.jsx"; // <-- add this
import "./index.css";
import "./legacy.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <AuthGate />
    </BrowserRouter>
  </React.StrictMode>
);

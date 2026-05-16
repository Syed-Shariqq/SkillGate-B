import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { getJobByToken, startAssessment, getSession } from "./services/assessment/assessmentService";
import { getResult, pollForResult } from "./services/assessment/resultService";

window.__test = {
  getJobByToken,
  startAssessment,
  getSession,
  getResult,
  pollForResult,
}

createRoot(document.getElementById("root")).render(
  <App />
);
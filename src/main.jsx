import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { getJobByToken, startAssessment, getSession, getAssessment } from "./services/assessment/assessmentService";
import { getResult, pollForResult } from "./services/assessment/resultService";
import { supabase } from "./config/supabase.js";

window.__test = {
  getJobByToken,
  startAssessment,
  getSession,
  getResult,
  pollForResult,
  getAssessment
}

window.supabase = supabase

createRoot(document.getElementById("root")).render(
  <App />
);
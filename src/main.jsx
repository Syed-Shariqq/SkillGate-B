import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { startAssessment, getSession, clearSession, getAssessment } from './services/assessment/assessmentService';
import { getCandidateResult, getResult, pollForResult } from "./services/assessment/resultService";
import { supabase } from "./config/supabase.js";
import { saveResponse, submitAssessment } from "./services/assessment/responseService.js";

window.__test = {
  startAssessment,
  getAssessment,
  getSession,
  clearSession,
  getResult,
  pollForResult,
  saveResponse,
  submitAssessment,
  getCandidateResult,
}

window.supabase = supabase

createRoot(document.getElementById("root")).render(
  <App />
);

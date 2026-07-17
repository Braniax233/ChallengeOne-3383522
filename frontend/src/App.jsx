import { Routes, Route, Navigate } from "react-router-dom";
import Draggable from "react-draggable";
import { useAuth } from "./context/AuthContext";
import { useEffect, useState, useRef } from "react";
import { syncOfflineReadings } from "./api/readings";
import { Moon, Sun } from "lucide-react";

// Auth page
import LoginPage from "./pages/LoginPage";

// Layouts
import ClinicianLayout from "./layouts/ClinicianLayout";
import ProviderLayout from "./layouts/ProviderLayout";
import PatientLayout from "./layouts/PatientLayout";

// Clinician pages
import ClinicianDashboard from "./pages/clinician/Dashboard";
import PatientList from "./pages/clinician/PatientList";
import PatientDetail from "./pages/clinician/PatientDetail";
import Alerts from "./pages/clinician/Alerts";
import Reports from "./pages/clinician/Reports";
import ClinicianSettings from "./pages/clinician/Settings";

// Provider pages
import ProviderDashboard from "./pages/provider/Dashboard";
import CaptureReading from "./pages/provider/CaptureReading";
import ProviderPatients from "./pages/provider/Patients";

// Patient pages
import PatientDashboard from "./pages/patient/Dashboard";
import PatientHistory from "./pages/patient/History";
import PatientCapture from "./pages/patient/CaptureReading";

// ── Protected route guard ────────────────────────────────────────────────────
/**
 * ProtectedRoute
 * Renders children only when the user is authenticated AND (optionally) has
 * one of the allowed roles.  Otherwise redirects to /login.
 *
 * @param {string[]} [allowedRoles]  — if omitted, any authenticated user is allowed
 */
function ProtectedRoute({ children, allowedRoles }) {
  const { isAuthenticated, user, loading } = useAuth();

  // While the mount-time token validation is in-flight, render nothing
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0f1e]">
        <span className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    // Redirect to their own dashboard if they hit a route for a different role
    const roleHome = {
      clinician: "/clinician/dashboard",
      provider: "/provider/dashboard",
      patient: "/patient/dashboard",
    };
    return <Navigate to={roleHome[user?.role] ?? "/login"} replace />;
  }

  return children;
}

export default function App() {
  const [darkMode, setDarkMode] = useState(false);
  const nodeRef = useRef(null);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

  useEffect(() => {
    const handleOnline = () => {
      console.log("App is online! Syncing offline readings...");
      syncOfflineReadings();
    };
    window.addEventListener("online", handleOnline);
    // Attempt sync immediately on load just in case we started offline and reconnected
    syncOfflineReadings();
    return () => window.removeEventListener("online", handleOnline);
  }, []);

  return (
    <>
      <Draggable nodeRef={nodeRef} bounds="body">
        <button 
          ref={nodeRef}
          onClick={() => setDarkMode(d => !d)}
          className="fixed bottom-6 right-6 z-50 w-12 h-12 bg-teal-600 rounded-full shadow-lg flex items-center justify-center transition-colors hover:bg-teal-700 hover:scale-105 active:scale-95 border-2 border-white/20 dark-toggle-btn cursor-move"
          title="Drag me!"
        >
          {darkMode ? <Sun size={20} className="text-white dark-toggle-icon" /> : <Moon size={20} className="text-white dark-toggle-icon" />}
        </button>
      </Draggable>

    <Routes>
      {/* ── Login page ────────────────────────────────────────────────────── */}
      <Route path="/login" element={<LoginPage />} />

      {/* Default / → redirect based on auth handled by LoginPage's useEffect */}
      <Route path="/" element={<Navigate to="/login" replace />} />

      {/* ── Clinician ───────────────────────────────────────────────────────── */}
      <Route
        path="/clinician"
        element={
          <ProtectedRoute allowedRoles={["clinician"]}>
            <ClinicianLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/clinician/dashboard" replace />} />
        <Route path="dashboard" element={<ClinicianDashboard />} />
        <Route path="patients" element={<PatientList />} />
        <Route path="patients/:id" element={<PatientDetail />} />
        <Route path="alerts" element={<Alerts />} />
        <Route path="reports" element={<Reports />} />
        <Route path="settings" element={<ClinicianSettings />} />
      </Route>

      {/* ── Provider ────────────────────────────────────────────────────────── */}
      <Route
        path="/provider"
        element={
          <ProtectedRoute allowedRoles={["provider"]}>
            <ProviderLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/provider/dashboard" replace />} />
        <Route path="dashboard" element={<ProviderDashboard />} />
        <Route path="capture" element={<CaptureReading />} />
        <Route path="patients" element={<ProviderPatients />} />
        <Route path="patients/:id" element={<PatientDetail />} />
      </Route>

      {/* ── Patient ─────────────────────────────────────────────────────────── */}
      <Route
        path="/patient"
        element={
          <ProtectedRoute allowedRoles={["patient"]}>
            <PatientLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/patient/dashboard" replace />} />
        <Route path="dashboard" element={<PatientDashboard />} />
        <Route path="history" element={<PatientHistory />} />
        <Route path="capture" element={<PatientCapture />} />
      </Route>

      {/* Catch-all → login */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
    </>
  );
}

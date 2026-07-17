import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Search,
  Plus,
  Eye,
  Edit2,
  Users,
  Clock,
  ChevronLeft,
  ChevronRight,
  X,
  AlertCircle,
} from "lucide-react";
import { getAllPatients } from "../../api/patients";
import StatusBadge from "../../components/StatusBadge";
import LoadingSpinner from "../../components/LoadingSpinner";
import EmptyState from "../../components/EmptyState";

// ── Helpers ────────────────────────────────────────────────────────────────────
const getInitials = (name = "") =>
  name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "??";

const formatTimeAgo = (date) => {
  if (!date) return "—";
  const m = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
};

const AVATAR_COLORS = [
  "bg-teal-500",
  "bg-blue-500",
  "bg-violet-500",
  "bg-coral-400",
  "bg-amber-500",
  "bg-cyan-500",
];
const avatarColor = (id = "") =>
  AVATAR_COLORS[id.charCodeAt(0) % AVATAR_COLORS.length];

// Normalize imported MOCK_PATIENTS to the field shape the JSX expects
const normalizePts = (pts) =>
  pts.map((p) => ({
    ...p,
    memberId: p.membershipId ?? p.memberId,
    status: p.latestReading?.status ?? p.status,
    updatedAt: p.latestReading?.timestamp ?? p.updatedAt,
    age: p.dob
      ? Math.floor(
          (Date.now() - new Date(p.dob).getTime()) / (365.25 * 24 * 3600000),
        )
      : (p.age ?? null),
    latestReading: p.latestReading
      ? {
          hr: p.latestReading.heartRate ?? p.latestReading.hr,
          spo2: p.latestReading.spo2,
        }
      : null,
  }));

const PAGE_SIZE = 7;

// ── Add Patient Modal ──────────────────────────────────────────────────────────
function AddPatientModal({ onClose, onAdded }) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    memberId: "",
    age: "",
    gender: "Male",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email) {
      setError("Name and email are required.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { ref, push, set } = await import('firebase/database');
      const { rtdb } = await import('../../api/firebase');
      
      const newRef = push(ref(rtdb, 'users'));
      const profile = {
        name: form.name.trim(),
        memberId: form.memberId.trim().toUpperCase(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        gender: form.gender,
        dob: form.age ? new Date(Date.now() - (form.age * 365.25 * 24 * 3600000)).toISOString() : null,
        role: 'patient',
        createdAt: Date.now(),
        isActive: true,
      };
      await set(newRef, profile);
      
      onAdded({ _id: newRef.key, uid: newRef.key, ...profile, age: form.age });
      onClose();
    } catch (err) {
      setError(err?.message || "Failed to add patient to database.");
    } finally {
      setLoading(false);
    }
  };

  const inputCls = "w-full text-sm border border-ink-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-200 focus:border-teal-400 transition";

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-ink-800 rounded-2xl shadow-card-hover w-full max-w-md animate-fade-in">
        <div className="flex items-center justify-between px-5 py-4 border-b border-ink-100">
          <h3 className="text-sm font-bold text-ink-900 dark:text-gray-100 ">Add New Patient</h3>
          <button onClick={onClose} className="icon-btn w-7 h-7">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-ink-600 dark:text-gray-300 mb-1">Full Name *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={inputCls} placeholder="Jane Smith" />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-600 dark:text-gray-300 mb-1">Email *</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                className={inputCls} placeholder="patient@email.com" />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-600 dark:text-gray-300 mb-1">Phone</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className={inputCls} placeholder="+1 234 567 8900" />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-600 dark:text-gray-300 mb-1">Membership ID</label>
              <input value={form.memberId} onChange={(e) => setForm({ ...form, memberId: e.target.value })}
                className={inputCls} placeholder="VX-009" />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-600 dark:text-gray-300 mb-1">Age</label>
              <input type="number" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })}
                className={inputCls} placeholder="35" min="1" max="120" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-ink-600 dark:text-gray-300 mb-1">Gender</label>
              <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}
                className={inputCls}>
                <option>Male</option>
                <option>Female</option>
                <option>Other</option>
              </select>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-coral-500 text-xs bg-coral-50 border border-coral-100 px-3 py-2 rounded-xl">
              <AlertCircle size={13} /> {error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 rounded-xl border border-ink-200 text-sm text-ink-600 dark:text-gray-300 hover:bg-ink-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 py-2 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-semibold transition-colors disabled:opacity-60">
              {loading ? "Adding…" : "Add Patient"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function PatientList() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get("q") || "");
  const [filter, setFilter] = useState("ALL"); // ALL | NORMAL | WARNING | CRITICAL
  const [page, setPage] = useState(1);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    getAllPatients()
      .then(setPatients)
      .catch(() => setPatients([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let list = patients;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name?.toLowerCase().includes(q) ||
          p.memberId?.toLowerCase().includes(q) ||
          p.email?.toLowerCase().includes(q),
      );
    }
    if (filter !== "ALL") {
      list = list.filter((p) => (p.status || "").toUpperCase() === filter);
    }
    return list;
  }, [patients, search, filter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleAdded = (newPatient) => {
    setPatients((prev) => [newPatient, ...prev]);
  };

  if (loading) return <LoadingSpinner message="Loading patients…" />;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by name, ID, or email…"
            className="w-full pl-9 pr-4 py-2 text-sm border border-ink-200 rounded-xl bg-white dark:bg-ink-800 focus:outline-none focus:ring-2 focus:ring-teal-300 focus:border-teal-400 transition"
          />
          {search && (
            <button
              onClick={() => { setSearch(""); setPage(1); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-1 bg-ink-100 rounded-xl p-1">
          {["ALL", "NORMAL", "WARNING", "CRITICAL"].map((f) => (
            <button
              key={f}
              onClick={() => { setFilter(f); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filter === f
                  ? "bg-white dark:bg-ink-800 text-ink-900 dark:text-gray-100 shadow-sm"
                  : "text-ink-500 dark:text-gray-400 hover:text-ink-800 dark:text-gray-200"
              }`}
            >
              {f === "ALL" ? "All" : f.charAt(0) + f.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 bg-teal-500 hover:bg-teal-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors shadow-sm whitespace-nowrap"
        >
          <Plus size={15} /> Add Patient
        </button>
      </div>

      {/* Table */}
      <div className="vx-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr>
                {[
                  "Patient",
                  "Membership ID",
                  "Age / Gender",
                  "Assigned To",
                  "Status",
                  "Last Reading",
                  "Actions",
                ].map((h) => (
                  <th
                    key={h}
                    className="text-left text-xs font-medium text-ink-400 px-5 py-3"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-50">
              {paged.map((patient) => (
                <tr
                  key={patient._id}
                  className="hover:bg-teal-50/30 transition-colors group cursor-pointer"
                  onClick={() => navigate(`/clinician/patients/${patient._id}`)}
                >
                  {/* Patient */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 text-xs font-bold flex-shrink-0">
                        {getInitials(patient.name)}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-ink-800 dark:text-gray-200">{patient.name}</p>
                        <p className="text-xs text-ink-400 truncate max-w-[140px]">{patient.email}</p>
                      </div>
                    </div>
                  </td>

                  {/* Membership ID */}
                  <td className="px-5 py-4">
                    <span className="font-mono text-xs bg-ink-100 text-ink-700 px-2 py-0.5 rounded-lg">
                      {patient.memberId || "—"}
                    </span>
                  </td>

                  {/* Age / Gender */}
                  <td className="px-5 py-4 text-sm text-ink-600 dark:text-gray-300">
                    {patient.age ? `${patient.age} yrs` : "—"} · {patient.gender || "—"}
                  </td>

                  {/* Assigned */}
                  <td className="px-5 py-4 text-sm text-ink-600 dark:text-gray-300">
                    {patient.assignedClinician || patient.clinician?.name || "—"}
                  </td>

                  {/* Status */}
                  <td className="px-5 py-4">
                    <StatusBadge status={patient.status} />
                  </td>

                  {/* Last Reading */}
                  <td className="px-5 py-4">
                    {patient.latestReading ? (
                      <div>
                        <p className="text-xs font-medium text-ink-700">
                          HR: {patient.latestReading.hr} · SpO₂: {patient.latestReading.spo2}%
                        </p>
                        <div className="flex items-center gap-1 text-ink-400 mt-0.5">
                          <Clock size={11} />
                          <span className="text-[11px]">{formatTimeAgo(patient.updatedAt)}</span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-ink-400">No readings yet</span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-5 py-4" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => navigate(`/clinician/patients/${patient._id}`)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg border border-ink-200 text-ink-400 hover:border-teal-300 hover:text-teal-500 transition-colors"
                        title="View"
                      >
                        <Eye size={13} />
                      </button>
                      <button
                        className="w-7 h-7 flex items-center justify-center rounded-lg border border-ink-200 text-ink-400 hover:border-teal-300 hover:text-teal-500 transition-colors"
                        title="Edit"
                      >
                        <Edit2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {paged.length === 0 && (
            <EmptyState
              icon={Users}
              title="No patients found"
              description={
                search
                  ? `No results for "${search}"`
                  : "No patients match the selected filter."
              }
            />
          )}
        </div>

        {/* Pagination */}
        {filtered.length > PAGE_SIZE && (
          <div className="px-5 py-4 border-t border-ink-100 flex items-center justify-between">
            <p className="text-xs text-ink-400">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
            </p>
            <div className="flex items-center gap-1">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:bg-ink-100 disabled:opacity-30 transition-colors"
              >
                <ChevronLeft size={14} />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  onClick={() => setPage(n)}
                  className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${
                    n === page
                      ? "bg-teal-500 text-white"
                      : "text-ink-600 dark:text-gray-300 hover:bg-ink-100"
                  }`}
                >
                  {n}
                </button>
              ))}
              <button
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:bg-ink-100 disabled:opacity-30 transition-colors"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {showAdd && (
        <AddPatientModal
          onClose={() => setShowAdd(false)}
          onAdded={handleAdded}
        />
      )}
    </div>
  );
}

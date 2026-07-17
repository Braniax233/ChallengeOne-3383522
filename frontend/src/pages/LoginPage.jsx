import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity, Building2, Home, Stethoscope, UserCheck,
  LogIn, UserPlus, ArrowLeft, Eye, EyeOff, AlertCircle,
  Heart, Lock, Mail, User, Phone, Calendar, ChevronRight,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

// ── Constants ──────────────────────────────────────────────────────────────────
const ROLE_LABELS   = { doctor: "Doctor", nurse: "Nurse", home: "Patient" };
const ROLE_BACKEND  = { doctor: "clinician", nurse: "provider", home: "patient" };
const ROLE_HOME_PATH = {
  clinician: "/clinician/dashboard",
  provider:  "/provider/dashboard",
  patient:   "/patient/dashboard",
};

// ── Input style ────────────────────────────────────────────────────────────────
const inputClass =
  "border border-ink-200 bg-white dark:bg-ink-800 text-ink-900 dark:text-gray-100 placeholder-ink-400 rounded-xl px-4 py-2.5 w-full text-sm focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-200 transition-all";
const labelClass = "text-xs font-medium text-ink-600 dark:text-gray-300 mb-1 block";

// ── Context/Role selection card ────────────────────────────────────────────────
function SelectionCard({ icon: Icon, label, subtitle, onClick, accent = "teal", delay = 0 }) {
  const colors = {
    teal:   "bg-teal-50 border-teal-200 hover:border-teal-400 hover:bg-teal-100 dark:bg-teal-900/30 dark:border-teal-800/50 dark:hover:bg-teal-800/40",
    blue:   "bg-blue-50 border-blue-200 hover:border-blue-400 hover:bg-blue-100 dark:bg-blue-900/30 dark:border-blue-800/50 dark:hover:bg-blue-800/40",
    purple: "bg-purple-50 border-purple-200 hover:border-purple-400 hover:bg-purple-100 dark:bg-purple-900/30 dark:border-purple-800/50 dark:hover:bg-purple-800/40",
    coral:  "bg-coral-50 border-coral-100 hover:border-coral-300 hover:bg-coral-100 dark:bg-coral-900/30 dark:border-coral-800/50 dark:hover:bg-coral-800/40",
  };
  const iconColors = {
    teal:   "bg-teal-100 text-teal-600 dark:bg-teal-500/20 dark:text-teal-400",
    blue:   "bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400",
    purple: "bg-purple-100 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400",
    coral:  "bg-coral-100 text-coral-500 dark:bg-coral-500/20 dark:text-coral-400",
  };
  return (
    <button
      onClick={onClick}
      style={{ animationDelay: `${delay}s` }}
      className={`group w-full flex items-center gap-4 p-4 border rounded-2xl transition-all duration-200 hover:shadow-card-hover animate-fade-in text-left ${colors[accent]}`}
    >
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${iconColors[accent]}`}>
        <Icon size={22} />
      </div>
      <div className="flex-1">
        <p className="text-sm font-bold text-ink-900 dark:text-gray-100 ">{label}</p>
        {subtitle && <p className="text-xs text-ink-500 dark:text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      <ChevronRight size={16} className="text-ink-300 group-hover:text-ink-600 dark:text-gray-300 transition-colors" />
    </button>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function LoginPage() {
  const { login, register, isAuthenticated, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [step,     setStep]    = useState("context");
  const [visible,  setVisible] = useState(true);
  const [uiRole,   setUiRole]  = useState(null);
  const [authMode, setAuthMode]= useState(null);

  const [form, setForm] = useState({
    name: "", email: "", password: "", confirmPassword: "",
    phone: "", department: "", dob: "", gender: "", memberId: "",
  });
  const [showPwd,        setShowPwd]        = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (isAuthenticated && user?.role) {
      navigate(ROLE_HOME_PATH[user.role] ?? "/login", { replace: true });
    }
  }, [isAuthenticated, user, authLoading, navigate]);

  const goToStep = (nextStep) => {
    setVisible(false);
    setTimeout(() => { setStep(nextStep); setError(""); setVisible(true); }, 180);
  };

  const handleBack = () => {
    if (step === "role") goToStep("context");
    else if (step === "auth") goToStep(uiRole === "home" ? "context" : "role");
    else if (step === "form") goToStep("auth");
  };

  const handleContextSelect = (type) => {
    if (type === "hospital") { goToStep("role"); }
    else { setUiRole("home"); goToStep("auth"); }
  };

  const handleRoleSelect = (role) => { setUiRole(role); goToStep("auth"); };
  const handleAuthMode   = (mode) => { setAuthMode(mode); goToStep("form"); };

  const updateField = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (authMode === 'signin') {
      if (!form.email.trim() || !form.password.trim()) {
        setError('Please enter your email and password.'); return;
      }
      setLoading(true); setError('');
      try {
        const loggedUser = await login(form.email.trim(), form.password);
        navigate(ROLE_HOME_PATH[loggedUser?.role] ?? '/login', { replace: true });
      } catch (err) {
        const code = err?.code || '';
        if (code.includes('user-not-found') || code.includes('wrong-password') || code.includes('invalid-credential'))
          setError('Incorrect email or password. Please try again.');
        else if (code.includes('too-many-requests'))
          setError('Too many failed attempts. Please wait a moment and try again.');
        else
          setError('Sign in failed. Please check your connection and try again.');
      } finally { setLoading(false); }
    } else {
      if (!form.name.trim() || !form.email.trim() || !form.password.trim()) {
        setError('Please fill in all required fields.'); return;
      }
      if (form.password !== form.confirmPassword) { setError('Passwords do not match.'); return; }
      if (form.password.length < 6) { setError('Password must be at least 6 characters.'); return; }
      setLoading(true); setError('');
      try {
        const userData = {
          name: form.name.trim(), email: form.email.trim(), password: form.password,
          role: ROLE_BACKEND[uiRole],
          ...(form.phone && { phone: form.phone.trim() }),
          ...(uiRole !== 'home' && form.department && { department: form.department.trim() }),
          ...(uiRole === 'home' && form.dob && { dob: form.dob }),
          ...(uiRole === 'home' && form.gender && { gender: form.gender }),
          ...(uiRole === 'home' && form.memberId && { memberId: form.memberId.trim() }),
        };
        const newUser = await register(userData);
        navigate(ROLE_HOME_PATH[newUser?.role] ?? '/login', { replace: true });
      } catch (err) {
        const code = err?.code || '';
        if (code.includes('email-already-in-use'))
          setError('An account with this email already exists. Try signing in instead.');
        else if (code.includes('invalid-email'))
          setError('Please enter a valid email address.');
        else if (code.includes('weak-password'))
          setError('Password is too weak. Use at least 6 characters.');
        else
          setError('Registration failed. Please check your connection and try again.');
      } finally { setLoading(false); }
    }
  };

  const RoleIcon = uiRole === "doctor" ? Stethoscope : uiRole === "nurse" ? UserCheck : Heart;

  return (
    <div className="min-h-screen bg-surface dark:bg-ink-950 flex">
      {/* ── Left decorative panel ─────────────────────────────────────────────── */}
      <div className="hidden lg:flex w-[420px] flex-shrink-0 bg-gradient-to-br from-teal-500 to-teal-700 flex-col justify-between p-10 relative overflow-hidden">
        {/* Blobs */}
        <div className="absolute top-0 right-0 w-72 h-72 bg-teal-400/30 rounded-full -translate-y-1/3 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-56 h-56 bg-teal-800/30 rounded-full translate-y-1/3 -translate-x-1/3" />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white dark:bg-ink-800 /20 backdrop-blur-sm flex items-center justify-center">
            <Activity size={20} className="text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-xl leading-none">VitalX</p>
            <p className="text-teal-200 text-[11px] tracking-widest uppercase mt-0.5">MediMonitor</p>
          </div>
        </div>

        {/* Center text */}
        <div className="relative z-10">
          <h2 className="text-white text-3xl font-bold leading-tight mb-4">
            Smart Patient<br />Monitoring
          </h2>
          <p className="text-teal-100 text-sm leading-relaxed">
            Real-time SpO₂ and heart rate monitoring for clinicians, providers, and patients — all in one platform.
          </p>

          {/* Stat pills */}
          <div className="mt-8 grid grid-cols-2 gap-3">
            {[
              { label: "Patients monitored", value: "2,400+" },
              { label: "Avg. response time",  value: "< 2min" },
              { label: "Device accuracy",     value: "99.2%"  },
              { label: "Uptime",              value: "99.9%"  },
            ].map((s) => (
              <div key={s.label} className="bg-white/10 dark:bg-ink-800/30 backdrop-blur-sm rounded-xl p-3 border border-white/20 dark:border-ink-700/50 shadow-sm">
                <p className="text-white font-bold text-lg">{s.value}</p>
                <p className="text-teal-100 text-[11px] mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom */}
        <div className="relative z-10">
          <p className="text-teal-200 text-xs">© {new Date().getFullYear()} Vital X · Secure Medical IoT Platform</p>
        </div>
      </div>

      {/* ── Right auth panel ──────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 overflow-y-auto">
        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-xl bg-teal-500 flex items-center justify-center">
            <Activity size={16} className="text-white" />
          </div>
          <span className="font-bold text-ink-900 dark:text-gray-100 text-lg">Vital<span className="text-teal-500">X</span></span>
        </div>

        {/* Content */}
        <div className="w-full max-w-sm">
          {/* Back button */}
          {step !== "context" && (
            <button
              onClick={handleBack}
              className="mb-6 flex items-center gap-1.5 text-sm text-ink-500 dark:text-gray-400 hover:text-ink-900 dark:text-gray-100 transition-colors group"
            >
              <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
              Back
            </button>
          )}

          <div className={`transition-all duration-180 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>

            {/* ── STEP 1: context ──────────────────────────────────────────── */}
            {step === "context" && (
              <div>
                <h1 className="text-2xl font-bold text-ink-900 dark:text-gray-100 mb-1">Welcome to VitalX</h1>
                <p className="text-sm text-ink-500 dark:text-gray-400 mb-6">How will you use the platform?</p>
                <div className="space-y-3">
                  <SelectionCard
                    icon={Building2} label="Hospital Staff" subtitle="Doctors, nurses & clinicians"
                    accent="teal" onClick={() => handleContextSelect("hospital")} delay={0}
                  />
                  <SelectionCard
                    icon={Home} label="Patient" subtitle="Home monitoring & personal records"
                    accent="blue" onClick={() => handleContextSelect("home")} delay={0.05}
                  />
                </div>
              </div>
            )}

            {/* ── STEP 2: role ─────────────────────────────────────────────── */}
            {step === "role" && (
              <div>
                <h1 className="text-2xl font-bold text-ink-900 dark:text-gray-100 mb-1">Select your role</h1>
                <p className="text-sm text-ink-500 dark:text-gray-400 mb-6">Choose your position at the hospital</p>
                <div className="space-y-3">
                  <SelectionCard
                    icon={Stethoscope} label="Doctor / Clinician" subtitle="Patient monitoring & alerts"
                    accent="teal" onClick={() => handleRoleSelect("doctor")} delay={0}
                  />
                  <SelectionCard
                    icon={UserCheck} label="Nurse / Provider" subtitle="Reading capture & records"
                    accent="purple" onClick={() => handleRoleSelect("nurse")} delay={0.05}
                  />
                </div>
              </div>
            )}

            {/* ── STEP 3: auth mode ────────────────────────────────────────── */}
            {step === "auth" && (
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <RoleIcon size={20} className="text-teal-500" />
                  <h1 className="text-2xl font-bold text-ink-900 dark:text-gray-100 ">
                    Welcome, {ROLE_LABELS[uiRole]}
                  </h1>
                </div>
                <p className="text-sm text-ink-500 dark:text-gray-400 mb-6">Sign in or create a new account</p>
                <div className="space-y-3">
                  <SelectionCard
                    icon={LogIn} label="Sign In" subtitle="Access your existing account"
                    accent="teal" onClick={() => handleAuthMode("signin")} delay={0}
                  />
                  <SelectionCard
                    icon={UserPlus} label="Create Account" subtitle="Register as a new user"
                    accent="blue" onClick={() => handleAuthMode("signup")} delay={0.05}
                  />
                </div>
              </div>
            )}

            {/* ── STEP 4: form ─────────────────────────────────────────────── */}
            {step === "form" && (
              <div>
                <h1 className="text-2xl font-bold text-ink-900 dark:text-gray-100 mb-0.5">
                  {authMode === "signin" ? "Sign In" : "Create Account"}
                </h1>
                <p className="text-sm text-ink-400 mb-6">
                  {ROLE_LABELS[uiRole]} · {authMode === "signin" ? "Welcome back" : "New account"}
                </p>

                <form onSubmit={handleSubmit} noValidate className="space-y-3">
                  {/* ── Sign In fields ──────────────────────────────────────── */}
                  {authMode === "signin" && (
                    <>
                      <div>
                        <label className={labelClass}>Email address</label>
                        <div className="relative">
                          <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
                          <input type="email" autoComplete="email" value={form.email}
                            onChange={updateField("email")} placeholder="you@example.com"
                            disabled={loading} className={`${inputClass} pl-10`} />
                        </div>
                      </div>
                      <div>
                        <label className={labelClass}>Password</label>
                        <div className="relative">
                          <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
                          <input type={showPwd ? "text" : "password"} autoComplete="current-password"
                            value={form.password} onChange={updateField("password")} placeholder="••••••••"
                            disabled={loading} className={`${inputClass} pl-10 pr-10`} />
                          <button type="button" onClick={() => setShowPwd((v) => !v)} tabIndex={-1}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700 transition-colors">
                            {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                          </button>
                        </div>
                      </div>
                    </>
                  )}

                  {/* ── Sign Up fields ──────────────────────────────────────── */}
                  {authMode === "signup" && (
                    <>
                      <div>
                        <label className={labelClass}>Full Name *</label>
                        <div className="relative">
                          <User size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
                          <input type="text" autoComplete="name" value={form.name}
                            onChange={updateField("name")} placeholder="John Doe"
                            disabled={loading} className={`${inputClass} pl-10`} />
                        </div>
                      </div>
                      <div>
                        <label className={labelClass}>Email address *</label>
                        <div className="relative">
                          <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
                          <input type="email" autoComplete="email" value={form.email}
                            onChange={updateField("email")} placeholder="you@example.com"
                            disabled={loading} className={`${inputClass} pl-10`} />
                        </div>
                      </div>
                      <div>
                        <label className={labelClass}>Password *</label>
                        <div className="relative">
                          <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
                          <input type={showPwd ? "text" : "password"} autoComplete="new-password"
                            value={form.password} onChange={updateField("password")} placeholder="••••••••"
                            disabled={loading} className={`${inputClass} pl-10 pr-10`} />
                          <button type="button" onClick={() => setShowPwd((v) => !v)} tabIndex={-1}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700 transition-colors">
                            {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className={labelClass}>Confirm Password *</label>
                        <div className="relative">
                          <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
                          <input type={showConfirmPwd ? "text" : "password"} autoComplete="new-password"
                            value={form.confirmPassword} onChange={updateField("confirmPassword")} placeholder="••••••••"
                            disabled={loading} className={`${inputClass} pl-10 pr-10`} />
                          <button type="button" onClick={() => setShowConfirmPwd((v) => !v)} tabIndex={-1}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700 transition-colors">
                            {showConfirmPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className={labelClass}>Phone {uiRole === "home" ? "*" : "(optional)"}</label>
                        <div className="relative">
                          <Phone size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
                          <input type="tel" autoComplete="tel" value={form.phone}
                            onChange={updateField("phone")} placeholder="+1 (555) 000-0000"
                            disabled={loading} className={`${inputClass} pl-10`} />
                        </div>
                      </div>
                      {(uiRole === "doctor" || uiRole === "nurse") && (
                        <div>
                          <label className={labelClass}>Department / Ward (optional)</label>
                          <input type="text" value={form.department} onChange={updateField("department")}
                            placeholder="e.g. Cardiology, ICU" disabled={loading} className={inputClass} />
                        </div>
                      )}
                      {uiRole === "home" && (
                        <>
                          <div className="sm:col-span-1">
                            <label className={labelClass}>Membership ID *</label>
                            <div className="relative">
                              <User size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
                              <input type="text" value={form.memberId} onChange={updateField("memberId")}
                                placeholder="From clinic (e.g. PX-123)" required disabled={loading} className={`${inputClass} pl-10`} />
                            </div>
                            <p className="text-[10px] text-ink-400 mt-1 ml-1">Needed to link your records.</p>
                          </div>
                          <div>
                            <label className={labelClass}>Date of Birth</label>
                            <div className="relative">
                              <Calendar size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
                              <input type="date" value={form.dob} onChange={updateField("dob")}
                                disabled={loading} className={`${inputClass} pl-10`} />
                            </div>
                          </div>
                          <div>
                            <label className={labelClass}>Gender</label>
                            <select value={form.gender} onChange={updateField("gender")}
                              disabled={loading} className={`${inputClass} appearance-none`}>
                              <option value="">Select gender</option>
                              <option value="male">Male</option>
                              <option value="female">Female</option>
                              <option value="other">Other</option>
                            </select>
                          </div>
                        </>
                      )}
                    </>
                  )}

                  {/* Error */}
                  {error && (
                    <div className="flex items-start gap-2 bg-coral-50 border border-coral-100 text-coral-600 text-sm px-3 py-2.5 rounded-xl">
                      <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-teal-500 hover:bg-teal-600 text-white font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm mt-1"
                  >
                    {loading ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        {authMode === "signin" ? "Signing in…" : "Creating account…"}
                      </>
                    ) : (
                      <>
                        {authMode === "signin" ? <LogIn size={15} /> : <UserPlus size={15} />}
                        {authMode === "signin" ? "Sign In" : "Create Account"}
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

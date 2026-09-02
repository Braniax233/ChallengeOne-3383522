import { useState, useEffect } from 'react';
import { FileText, Download, Users, AlertCircle, Eye, X } from 'lucide-react';
import { BarChart as ReBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import EmptyState from '../../components/EmptyState';
import LoadingSpinner from '../../components/LoadingSpinner';
import { getReportStats, getReports } from '../../api/reports';

const TYPE_BADGE = {
  Summary:    'bg-teal-50 text-teal-600',
  Individual: 'bg-blue-50 text-blue-600',
  Alerts:     'bg-coral-50 text-coral-500',
};

const SUMMARY_STATS = [
  { label: 'Reports Generated', value: 42, sub: 'This month',    icon: FileText,    color: 'teal'  },
  { label: 'Patients Covered',  value: 8,  sub: 'Active records', icon: Users,       color: 'blue'  },
  { label: 'Alert Reports',     value: 6,  sub: 'This month',    icon: AlertCircle, color: 'coral' },
  { label: 'Exports Today',     value: 3,  sub: 'PDF & CSV',     icon: Download,    color: 'ink'   },
];

const iconColors = {
  teal:  'bg-teal-50 text-teal-600',
  blue:  'bg-blue-50 text-blue-600',
  coral: 'bg-coral-50 text-coral-500',
  ink:   'bg-ink-100 text-ink-600 dark:text-gray-300',
};

export default function Reports() {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo,   setDateTo]   = useState('');
  const [type,     setType]     = useState('all');
  
  const [loading, setLoading]   = useState(true);
  const [reports, setReports]   = useState([]);
  const [weekData, setWeekData] = useState([]);
  const [stats, setStats]       = useState(null);
  const [viewingReport, setViewingReport] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [statsData, reportsData] = await Promise.all([
          getReportStats(),
          getReports()
        ]);
        setWeekData(statsData.weeklyData);
        setStats(statsData.summaryStats);
        setReports(reportsData);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = reports.filter((r) => {
    if (type !== 'all' && r.type !== type) return false;
    if (dateFrom && new Date(r.generated) < new Date(dateFrom)) return false;
    if (dateTo   && new Date(r.generated) > new Date(dateTo))   return false;
    return true;
  });

  const handleExportAll = () => {
    const csvContent = [
      "Day,Date,Normal,Warning,Critical",
      ...weekData.map(d => `${d.day},${d.dateStr},${d.normal},${d.warning},${d.critical}`)
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `vitalwatch_summary_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownload = (report) => {
    const content = `Report ID: ${report.id}\nTitle: ${report.title}\nPatient: ${report.patient}\nType: ${report.type}\nGenerated: ${report.generated.toDateString()}`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${report.id}_export.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) return <LoadingSpinner message="Generating reports view..." />;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Reports Generated', value: stats?.reportsGenerated || 0, sub: 'This month',    icon: FileText,    color: 'teal'  },
          { label: 'Patients Covered',  value: stats?.patientsCovered || 0,  sub: 'Active records', icon: Users,       color: 'blue'  },
          { label: 'Alert Reports',     value: stats?.alertReports || 0,     sub: 'This month',    icon: AlertCircle, color: 'coral' },
          { label: 'Exports Today',     value: stats?.exportsToday || 0,     sub: 'PDF & CSV',     icon: Download,    color: 'ink'   },
        ].map((s) => (
          <div key={s.label} className="vx-card p-5 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${iconColors[s.color]}`}>
              <s.icon size={18} />
            </div>
            <div>
              <p className="text-2xl font-bold text-ink-900 dark:text-gray-100 ">{s.value}</p>
              <p className="text-xs text-ink-500 dark:text-gray-400">{s.label}</p>
              <p className="text-[11px] text-ink-400">{s.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Weekly chart */}
      <div className="vx-card">
        <div className="px-5 py-4 border-b border-ink-100">
          <h3 className="text-sm font-bold text-ink-900 dark:text-gray-100 ">Weekly Reading Summary</h3>
          <p className="text-xs text-ink-400 mt-0.5">Status distribution across all patients this week</p>
        </div>
        <div className="p-5">
          <ResponsiveContainer width="100%" height={220}>
            <ReBarChart data={weekData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F2F5" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#B0B4BF' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#B0B4BF' }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 12, border: '1px solid #E4E6EB', boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="normal"   name="Normal"   fill="#3AA49E" radius={[4, 4, 0, 0]} />
              <Bar dataKey="warning"  name="Warning"  fill="#F59E0B" radius={[4, 4, 0, 0]} />
              <Bar dataKey="critical" name="Critical" fill="#F45D52" radius={[4, 4, 0, 0]} />
            </ReBarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Reports table */}
      <div className="vx-card">
        <div className="px-5 py-4 border-b border-ink-100">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <h3 className="text-sm font-bold text-ink-900 dark:text-gray-100 flex-1">Recent Reports</h3>
            <div className="flex items-center gap-2 flex-wrap">
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                className="text-xs border border-ink-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-200 focus:border-teal-400" />
              <span className="text-ink-400 text-xs">to</span>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                className="text-xs border border-ink-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-200 focus:border-teal-400" />
              <select value={type} onChange={(e) => setType(e.target.value)}
                className="text-xs border border-ink-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-200 focus:border-teal-400">
                <option value="all">All Types</option>
                <option value="Summary">Summary</option>
                <option value="Individual">Individual</option>
                <option value="Alerts">Alerts</option>
              </select>
              <button onClick={handleExportAll} className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-500 hover:bg-teal-600 text-white text-xs font-semibold rounded-lg transition-colors">
                <Download size={13} /> Export All
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                {['Report ID', 'Title', 'Patient', 'Type', 'Generated', 'Size', ''].map((h) => (
                  <th key={h} className="text-left text-xs font-medium text-ink-400 px-5 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-50">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-teal-50/30 transition-colors group">
                  <td className="px-5 py-3.5">
                    <span className="font-mono text-xs bg-ink-100 text-ink-600 dark:text-gray-300 px-2 py-0.5 rounded-lg">{r.id}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <FileText size={14} className="text-ink-300 flex-shrink-0" />
                      <span className="text-sm font-medium text-ink-800 dark:text-gray-200">{r.title}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-ink-600 dark:text-gray-300">{r.patient}</td>
                  <td className="px-5 py-3.5">
                    <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${TYPE_BADGE[r.type]}`}>{r.type}</span>
                  </td>
                  <td className="px-5 py-3.5 text-xs text-ink-500 dark:text-gray-400">
                    {r.generated.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                  <td className="px-5 py-3.5 text-xs text-ink-500 dark:text-gray-400">{r.size}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setViewingReport(r)} className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 font-medium">
                        <Eye size={13} /> View
                      </button>
                      <button onClick={() => handleDownload(r)} className="flex items-center gap-1 text-xs text-teal-500 hover:text-teal-700 font-medium">
                        <Download size={13} /> Download
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <EmptyState icon={FileText} title="No reports found" description="Try adjusting the date range or type filter." />
          )}
        </div>
      </div>

      {/* Report Viewing Modal */}
      {viewingReport && (
        <div className="fixed inset-0 bg-ink-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-ink-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-slide-up">
            <div className="flex items-center justify-between px-6 py-4 border-b border-ink-100">
              <div>
                <h2 className="text-lg font-bold text-ink-900 dark:text-gray-100">{viewingReport.title}</h2>
                <p className="text-xs text-ink-500">Report ID: {viewingReport.id} • {viewingReport.patient}</p>
              </div>
              <button onClick={() => setViewingReport(null)} className="p-2 text-ink-400 hover:bg-ink-100 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 bg-ink-50/50 dark:bg-ink-900/50">
              <div className="bg-white dark:bg-ink-800 p-6 rounded-xl border border-ink-100 font-mono text-sm text-ink-700 dark:text-gray-300 whitespace-pre-wrap">
                {`Report ID: ${viewingReport.id}\nTitle: ${viewingReport.title}\nPatient: ${viewingReport.patient}\nType: ${viewingReport.type}\nGenerated: ${viewingReport.generated.toDateString()}\n\n`}
                {`=== VITAL SIGNS SUMMARY ===\nHeart Rate: Normal Range\nSpO2: Stable\nTemperature: 36.6°C\n\n`}
                {`=== CLINICAL NOTES ===\nPatient is showing standard recovery signs. No anomalies detected in the recent monitoring window. Continue standard protocol.\n\n`}
                {`[End of Report]`}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-ink-100 flex items-center justify-end gap-3 bg-white dark:bg-ink-800">
              <button onClick={() => setViewingReport(null)} className="px-4 py-2 text-sm font-semibold text-ink-600 hover:bg-ink-100 rounded-lg transition-colors">
                Close
              </button>
              <button 
                onClick={() => { handleDownload(viewingReport); setViewingReport(null); }} 
                className="px-4 py-2 text-sm font-semibold text-white bg-teal-500 hover:bg-teal-600 rounded-lg transition-colors flex items-center gap-2"
              >
                <Download size={16} /> Download Copy
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

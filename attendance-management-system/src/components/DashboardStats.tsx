import { useMemo } from 'react';
import { Student, AttendanceStats, AttendanceSheet } from '../types';
import { 
  Users, 
  CalendarDays, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ShieldAlert 
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from 'recharts';

interface DashboardStatsProps {
  stats: AttendanceStats | null;
  students: Student[];
  sheets: AttendanceSheet[];
  onNavigateToStudents: () => void;
  onNavigateToMarker: (date?: string) => void;
}

export default function DashboardStats({ 
  stats, 
  students, 
  sheets,
  onNavigateToStudents,
  onNavigateToMarker
}: DashboardStatsProps) {

  // Calculate critical rosters (attendance < 80%)
  const atRiskStudents = useMemo(() => {
    if (!stats || students.length === 0) return [];
    
    return students.map(student => {
      const studentStat = stats.studentStats[student.id] || { 
        present: 0, 
        absent: 0, 
        late: 0, 
        excused: 0, 
        rate: 100, 
        totalDays: 0 
      };
      return {
        ...student,
        rate: studentStat.rate,
        totalDays: studentStat.totalDays,
        absentCount: studentStat.absent,
      };
    })
    .filter(s => s.totalDays > 0 && s.rate < 80)
    .sort((a, b) => a.rate - b.rate);
  }, [stats, students]);

  // Format Recharts data for the date trends
  const trendData = useMemo(() => {
    if (!stats || !stats.byDateStats) return [];
    return Object.entries(stats.byDateStats)
      .map(([date, value]) => ({
        date: date.substring(5), // Keep MM-DD format for chart readability
        fullDate: date,
        Rate: value.rate,
        PresentCount: value.present,
        AbsentCount: value.absent,
        LateCount: value.late,
        ExcusedCount: value.excused,
      }))
      .sort((a, b) => a.fullDate.localeCompare(b.fullDate));
  }, [stats]);

  // Format data for the overall status distribution chart
  const statusDistributionData = useMemo(() => {
    if (!stats) return [];
    return [
      { name: 'Present', count: stats.statusCounts.present, color: '#10b981' },
      { name: 'Late', count: stats.statusCounts.late, color: '#f59e0b' },
      { name: 'Excused', count: stats.statusCounts.excused, color: '#3b82f6' },
      { name: 'Absent', count: stats.statusCounts.absent, color: '#ef4444' },
    ];
  }, [stats]);

  if (!stats) {
    return (
      <div id="stats-loading" className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-slate-600"></div>
      </div>
    );
  }

  return (
    <div id="dashboard-container" className="space-y-8">
      {/* Metrics Section */}
      <div id="metrics-grid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Students Card */}
        <div 
          id="metric-students-card"
          className="bg-white rounded-2xl shadow-xs border border-slate-100 p-6 flex items-start justify-between cursor-pointer hover:border-slate-300 transition duration-200"
          onClick={onNavigateToStudents}
        >
          <div className="space-y-2">
            <span className="text-slate-500 text-sm font-medium">Active Students</span>
            <h3 className="text-3xl font-bold text-slate-800">{stats.totalStudents}</h3>
            <p className="text-xs text-emerald-600 font-medium">Roster fully loaded</p>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl text-slate-600">
            <Users className="h-6 w-6" />
          </div>
        </div>

        {/* Attendance Rate Card */}
        <div 
          id="metric-avg-rate-card"
          className="bg-white rounded-2xl shadow-xs border border-slate-100 p-6 flex items-start justify-between"
        >
          <div className="space-y-2">
            <span className="text-slate-500 text-sm font-medium">Avg. Attendance Rate</span>
            <h3 className="text-3xl font-bold text-slate-800">{stats.overallAttendanceRate}%</h3>
            <p className="text-xs text-slate-400 font-medium">Standard baseline: 90%</p>
          </div>
          <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
            <TrendingUp className="h-6 w-6" />
          </div>
        </div>

        {/* Sessions Tracked Card */}
        <div 
          id="metric-sessions-card"
          className="bg-white rounded-2xl shadow-xs border border-slate-100 p-6 flex items-start justify-between"
        >
          <div className="space-y-2">
            <span className="text-slate-500 text-sm font-medium">Days Tracked</span>
            <h3 className="text-3xl font-bold text-slate-800">{stats.totalSheets}</h3>
            <p className="text-xs text-amber-600 font-medium">Active academic term</p>
          </div>
          <div className="p-3 bg-amber-50 rounded-xl text-amber-600">
            <CalendarDays className="h-6 w-6" />
          </div>
        </div>

        {/* At Risk warning card */}
        <div 
          id="metric-atrisk-card"
          className="bg-white rounded-2xl shadow-xs border border-slate-100 p-6 flex items-start justify-between"
        >
          <div className="space-y-2">
            <span className="text-slate-500 text-sm font-medium">Students at Risk</span>
            <h3 className="text-3xl font-bold text-slate-800">{atRiskStudents.length}</h3>
            <p className="text-xs text-red-500 font-medium">Attendance &lt; 80%</p>
          </div>
          <div className={`p-3 rounded-xl ${atRiskStudents.length > 0 ? 'bg-red-50 text-red-600 animate-pulse' : 'bg-slate-50 text-slate-400'}`}>
            <AlertTriangle className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Grid Charts Section */}
      <div id="charts-grid" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Attendance Trend Chart */}
        <div id="trend-chart-card" className="bg-white p-6 rounded-2xl shadow-xs border border-slate-100 lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="font-semibold text-slate-800 text-base">Timeline Trend (%)</h4>
            <span className="text-xs text-slate-400 font-mono">Last {trendData.length} records</span>
          </div>
          <div className="h-72">
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis domain={[0, 100]} stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }} 
                    formatter={(value) => [`${value}% Attendance`]}
                  />
                  <Area type="monotone" dataKey="Rate" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorRate)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col justify-center items-center text-slate-400 text-sm bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                <p>No active trend lines detected.</p>
                <button 
                  onClick={() => onNavigateToMarker()}
                  className="mt-2 text-xs text-slate-600 underline hover:text-emerald-600 font-medium"
                >
                  Mark your first attendance sheet
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Status Distribution */}
        <div id="distribution-chart-card" className="bg-white p-6 rounded-2xl shadow-xs border border-slate-100 space-y-4">
          <h4 className="font-semibold text-slate-800 text-base">Aggregate Distribution</h4>
          <div className="h-72">
            {stats.statusCounts.present + stats.statusCounts.absent + stats.statusCounts.late + stats.statusCounts.excused > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusDistributionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={45}>
                    {statusDistributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex justify-center items-center text-slate-400 text-sm bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                No recorded attendance distributions.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row with Critical Invariant / At Risk Lists */}
      <div id="risk-alert-section" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* At Risk List (2/3 col if large or spans fully) */}
        <div id="risk-list-card" className="bg-white p-6 rounded-2xl shadow-xs border border-slate-100 lg:col-span-2 space-y-4">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-rose-500 animate-pulse" />
            <h4 className="font-semibold text-slate-800 text-base">Attendance Risk List &lt; 80%</h4>
          </div>
          {atRiskStudents.length > 0 ? (
            <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto custom-scrollbar">
              {atRiskStudents.map((stu) => (
                <div key={stu.id} className="py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold text-sm">
                      {stu.name.split(' ').map((n) => n[0]).join('')}
                    </div>
                    <div>
                      <h5 className="font-medium text-slate-800 text-sm">{stu.name}</h5>
                      <p className="text-xs text-slate-400 font-mono">{stu.rollNumber} • {stu.email || 'No email'}</p>
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    <span className="text-sm font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md font-mono">
                      {stu.rate}% Rate
                    </span>
                    <p className="text-xs text-slate-500">{stu.absentCount} absences in {stu.totalDays} sessions</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-8 bg-emerald-50/50 rounded-xl text-emerald-700 text-sm border border-emerald-100">
              <CheckCircle2 className="h-8 w-8 text-emerald-500 mb-2" />
              <p className="font-medium">All student records are healthy!</p>
              <p className="text-xs text-slate-400 mt-1">Every student holds an attendance rate above 80%.</p>
            </div>
          )}
        </div>

        {/* Quick Actions / Shortcuts Panel */}
        <div id="quick-shortcuts-card" className="bg-white p-6 rounded-2xl shadow-xs border border-slate-100 space-y-4 flex flex-col justify-between">
          <div>
            <h4 className="font-semibold text-slate-800 text-base mb-3">Roster Shortcuts</h4>
            <p className="text-slate-500 text-xs leading-relaxed">
              Quickly edit classroom registries, perform daily attendance roll call, or audit chronological histories.
            </p>
          </div>

          <div className="space-y-2 mt-4">
            <button 
              onClick={() => onNavigateToMarker(new Date().toISOString().split('T')[0])}
              className="w-full flex items-center justify-between p-3 rounded-xl bg-indigo-50/70 border border-indigo-100 text-indigo-700 hover:bg-indigo-50 font-medium text-sm transition"
            >
              <span className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Conduct Today's Roll Call
              </span>
              <span className="text-xs font-mono bg-indigo-100 px-1.5 py-0.5 rounded text-indigo-800">
                {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            </button>

            <button 
              onClick={onNavigateToStudents}
              className="w-full flex items-center gap-2 p-3 rounded-xl bg-slate-50 border border-slate-100 text-slate-750 hover:bg-slate-100 font-medium text-sm transition"
            >
              <Users className="h-4 w-4" />
              Add or Edit Students
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

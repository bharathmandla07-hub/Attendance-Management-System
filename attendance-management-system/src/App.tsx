import { useState, useEffect, useMemo, FormEvent } from 'react';
import { 
  Users, 
  Calendar, 
  ClipboardCheck, 
  History, 
  Plus, 
  Search, 
  RefreshCw, 
  UserPlus, 
  Trash2, 
  Edit2, 
  X, 
  Check, 
  AlertCircle,
  HelpCircle,
  FileCheck,
  CheckCircle,
  Clock,
  ArrowRight,
  Sparkles,
  Keyboard,
  Zap
} from 'lucide-react';
import { Student, AttendanceSheet, AttendanceStatus, DailyRecords, AttendanceStats } from './types';
import DashboardStats from './components/DashboardStats';

export default function App() {
  // Tabs config
  const [activeTab, setActiveTab] = useState<'dashboard' | 'attendance' | 'students' | 'history'>('dashboard');

  // Interactive Theme configuration (persisted in localStorage)
  const [appTheme, setAppTheme] = useState<'indigo' | 'emerald' | 'slate' | 'sunset'>(() => {
    return (localStorage.getItem('rosterflow-theme') as any) || 'indigo';
  });

  useEffect(() => {
    localStorage.setItem('rosterflow-theme', appTheme);
    const layout = document.getElementById('application-layout');
    if (layout) {
      layout.setAttribute('data-theme', appTheme);
    }
    document.documentElement.setAttribute('data-theme', appTheme);
  }, [appTheme]);

  // Core Entity States
  const [students, setStudents] = useState<Student[]>([]);
  const [sheets, setSheets] = useState<AttendanceSheet[]>([]);
  const [stats, setStats] = useState<AttendanceStats | null>(null);
  
  // Loading & Action States
  const [loading, setLoading] = useState<boolean>(true);
  const [submittingStudent, setSubmittingStudent] = useState<boolean>(false);
  const [submittingAttendance, setSubmittingAttendance] = useState<boolean>(false);
  const [refreshKey, setRefreshKey] = useState<number>(0);

  // Status/Toast Banner message state
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Student Manager search/filter and form state
  const [studentSearch, setStudentSearch] = useState<string>('');
  const [showAddStudentModal, setShowAddStudentModal] = useState<boolean>(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  
  // Student form input
  const [studentForm, setStudentForm] = useState({
    name: '',
    email: '',
    notes: ''
  });

  // Attendance Manager Roll Call Form state
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    const tzOffset = today.getTimezoneOffset() * 60000; // local offset
    const localISOTime = (new Date(Date.now() - tzOffset)).toISOString().slice(0, 10);
    return localISOTime;
  });
  
  // Local scratchpad for marking attendance, mapped key is student.id -> record
  const [localAttendance, setLocalAttendance] = useState<DailyRecords>({});
  const [allPresentQuickTrigger, setAllPresentQuickTrigger] = useState<boolean>(false);

  // Quick marking and dynamic fast-enrollment states
  const [keyboardActiveIndex, setKeyboardActiveIndex] = useState<number>(0);
  const [quickName, setQuickName] = useState<string>('');
  const [quickEnrolling, setQuickEnrolling] = useState<boolean>(false);

  // Keyboard roll-call listener for high-speed marking (P, A, L, E and Arrow navigation)
  useEffect(() => {
    if (activeTab !== 'attendance' || students.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (activeEl && (
        activeEl.tagName === 'INPUT' || 
        activeEl.tagName === 'TEXTAREA' || 
        activeEl.tagName === 'SELECT' || 
        activeEl.getAttribute('contenteditable') === 'true'
      )) {
        return;
      }

      const key = e.key.toLowerCase();
      
      if (key === 'arrowdown') {
        e.preventDefault();
        setKeyboardActiveIndex(prev => Math.min(prev + 1, students.length - 1));
      } else if (key === 'arrowup') {
        e.preventDefault();
        setKeyboardActiveIndex(prev => Math.max(prev - 1, 0));
      } else if (key === 'p') {
        e.preventDefault();
        const student = students[keyboardActiveIndex];
        if (student) {
          handleMarkStatus(student.id, 'present');
          if (keyboardActiveIndex < students.length - 1) {
            setKeyboardActiveIndex(prev => prev + 1);
          }
        }
      } else if (key === 'a') {
        e.preventDefault();
        const student = students[keyboardActiveIndex];
        if (student) {
          handleMarkStatus(student.id, 'absent');
          if (keyboardActiveIndex < students.length - 1) {
            setKeyboardActiveIndex(prev => prev + 1);
          }
        }
      } else if (key === 'l') {
        e.preventDefault();
        const student = students[keyboardActiveIndex];
        if (student) {
          handleMarkStatus(student.id, 'late');
          if (keyboardActiveIndex < students.length - 1) {
            setKeyboardActiveIndex(prev => prev + 1);
          }
        }
      } else if (key === 'e') {
        e.preventDefault();
        const student = students[keyboardActiveIndex];
        if (student) {
          handleMarkStatus(student.id, 'excused');
          if (keyboardActiveIndex < students.length - 1) {
            setKeyboardActiveIndex(prev => prev + 1);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, keyboardActiveIndex, students, localAttendance]);

  // Fast inline enrollment submission
  const handleQuickEnroll = async (e: FormEvent) => {
    e.preventDefault();
    if (!quickName.trim()) return;
    setQuickEnrolling(true);
    try {
      const res = await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: quickName.trim(), 
          email: `${quickName.toLowerCase().replace(/\s+/g, '.')}@classroom.edu`, 
          notes: '⚡ Fast-registered from active check-in' 
        })
      });

      if (!res.ok) {
        const errData = await res.json();
         throw new Error(errData.error || 'Failed quick registration.');
      }

      setBanner({
        type: 'success',
        message: `⚡ Fast-enrolled ${quickName.trim()} into classroom roster!`
      });
      setQuickName('');
      forceRefresh();
    } catch (err: any) {
      setBanner({ type: 'error', message: err.message || 'Quick registration failed.' });
    } finally {
      setQuickEnrolling(false);
    }
  };

  // History explorer filters and pagination state
  const [historySearch, setHistorySearch] = useState<string>('');
  const [historyFilterStatus, setHistoryFilterStatus] = useState<string>('all');

  // Auto-clear banner notifications after 5 seconds
  useEffect(() => {
    if (banner) {
      const timer = setTimeout(() => setBanner(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [banner]);

  // Initial and reactive data fetching
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [resStudents, resSheets, resStats] = await Promise.all([
          fetch('/api/students'),
          fetch('/api/attendance'),
          fetch('/api/attendance/stats')
        ]);

        if (!resStudents.ok || !resSheets.ok || !resStats.ok) {
          throw new Error('Some API resources failed to synchronize correctly.');
        }

        const dataStudents = await resStudents.json();
        const dataSheets = await resSheets.json();
        const dataStats = await resStats.json();

        setStudents(dataStudents);
        setSheets(dataSheets);
        setStats(dataStats);
      } catch (err: any) {
        setBanner({
          type: 'error',
          message: err.message || 'Failed to establish persistent storage link.'
        });
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [refreshKey]);

  // Fetch or setup current sheet's working scratchpad whenever date changes or students refresh
  useEffect(() => {
    async function fetchAttendanceForDate() {
      if (!selectedDate) return;
      try {
        const res = await fetch(`/api/attendance/date/${selectedDate}`);
        if (res.ok) {
          const sheet: AttendanceSheet & { isNew?: boolean } = await res.json();
          
          // Map students to records. Pre-fill with existing values or default to 'present' for new sheets
          const initialRecords: DailyRecords = {};
          students.forEach(student => {
            if (sheet.records && sheet.records[student.id]) {
              initialRecords[student.id] = { ...sheet.records[student.id] };
            } else {
              initialRecords[student.id] = { status: 'present', notes: '' };
            }
          });
          setLocalAttendance(initialRecords);
        }
      } catch (err) {
        console.error('Failed to sync sheet for target date: ', selectedDate);
      }
    }

    if (students.length > 0) {
      fetchAttendanceForDate();
    }
  }, [selectedDate, students]);

  const forceRefresh = () => setRefreshKey(prev => prev + 1);

  // Handlers for Add/Edit Student
  const handleOpenAddStudent = () => {
    setEditingStudent(null);
    setStudentForm({ name: '', email: '', notes: '' });
    setShowAddStudentModal(true);
  };

  const handleOpenEditStudent = (student: Student) => {
    setEditingStudent(student);
    setStudentForm({
      name: student.name,
      email: student.email || '',
      notes: student.notes || ''
    });
    setShowAddStudentModal(true);
  };

  const handleSubmitStudent = async (e: FormEvent) => {
    e.preventDefault();
    if (!studentForm.name.trim()) {
      setBanner({ type: 'error', message: 'Student Name is a required field.' });
      return;
    }

    setSubmittingStudent(true);
    try {
      const url = editingStudent ? `/api/students/${editingStudent.id}` : '/api/students';
      const method = editingStudent ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(studentForm)
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to save student record.');
      }

      setBanner({
        type: 'success',
        message: editingStudent 
          ? `Successfully updated profile wrapper for ${studentForm.name}.`
          : `Successfully registered ${studentForm.name} to the active roster.`
      });
      
      setShowAddStudentModal(false);
      setStudentForm({ name: '', email: '', notes: '' });
      setEditingStudent(null);
      forceRefresh();
    } catch (err: any) {
      setBanner({ type: 'error', message: err.message || 'Network submission interrupted.' });
    } finally {
      setSubmittingStudent(false);
    }
  };

  const handleDeleteStudent = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to permanently delete ${name}?\nAll history and attendance sessions linked to this student will be lost.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/students/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        throw new Error('Failed to purge student node from dataset.');
      }

      setBanner({
        type: 'success',
        message: `Purged ${name} and related session logs from active directory.`
      });
      forceRefresh();
    } catch (err: any) {
      setBanner({ type: 'error', message: err.message || 'Deletion write operation failed.' });
    }
  };

  // Handlers for Attendance
  const handleMarkStatus = (studentId: string, status: AttendanceStatus) => {
    setLocalAttendance(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        status
      }
    }));
  };

  const handleRecordNoteChange = (studentId: string, notes: string) => {
    setLocalAttendance(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        notes
      }
    }));
  };

  const handleToggleAllPresent = () => {
    const targetStatus: AttendanceStatus = allPresentQuickTrigger ? 'absent' : 'present';
    setLocalAttendance(prev => {
      const updated: DailyRecords = {};
      students.forEach(st => {
        updated[st.id] = {
          ...prev[st.id],
          status: targetStatus
        };
      });
      return updated;
    });
    setAllPresentQuickTrigger(!allPresentQuickTrigger);
  };

  const handleSaveAttendance = async () => {
    setSubmittingAttendance(true);
    try {
      const payload = {
        date: selectedDate,
        records: localAttendance
      };

      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error('Failed to record attendance bulk manifest to database.');
      }

      setBanner({
        type: 'success',
        message: `Successfully synchronized and locked attendance sheets for ${selectedDate}.`
      });
      forceRefresh();
      setActiveTab('dashboard'); // Jump to dashboard to inspect trend
    } catch (err: any) {
      setBanner({ type: 'error', message: err.message || 'Write transmission failure.' });
    } finally {
      setSubmittingAttendance(false);
    }
  };

  // Navigations triggered from Dashboard
  const handleQuickMarkToday = (predefinedDate?: string) => {
    if (predefinedDate) {
      setSelectedDate(predefinedDate);
    }
    setActiveTab('attendance');
  };

  // Computational filters
  const filteredStudents = useMemo(() => {
    return students.filter(st => {
      const searchStr = studentSearch.toLowerCase();
      return (
        st.name.toLowerCase().includes(searchStr) ||
        st.rollNumber.toLowerCase().includes(searchStr) ||
        (st.email && st.email.toLowerCase().includes(searchStr))
      );
    });
  }, [students, studentSearch]);

  // Comprehensive logs calculation for the grid matrix
  const matrixData = useMemo(() => {
    if (students.length === 0 || sheets.length === 0) return [];
    
    // Sort sheets by date ascending
    const sortedSheets = [...sheets].sort((a, b) => a.date.localeCompare(b.date));
    
    return students.map(student => {
      const historyRows: { [date: string]: { status: AttendanceStatus; notes?: string } | null } = {};
      let presentCount = 0;
      let lateCount = 0;
      let absentCount = 0;
      let excusedCount = 0;
      
      sortedSheets.forEach(sheet => {
        const rec = sheet.records[student.id];
        if (rec) {
          historyRows[sheet.date] = { status: rec.status, notes: rec.notes };
          switch (rec.status) {
            case 'present': presentCount++; break;
            case 'late': lateCount++; break;
            case 'absent': absentCount++; break;
            case 'excused': excusedCount++; break;
          }
        } else {
          historyRows[sheet.date] = null;
        }
      });

      const totalWorkedDays = presentCount + lateCount + absentCount + excusedCount;
      const rate = totalWorkedDays > 0 
        ? Math.round(((presentCount + lateCount + excusedCount) / totalWorkedDays) * 100) 
        : 100;

      return {
        id: student.id,
        name: student.name,
        rollNumber: student.rollNumber,
        historyRows,
        stats: {
          present: presentCount,
          late: lateCount,
          absent: absentCount,
          excused: excusedCount,
          total: totalWorkedDays,
          rate
        }
      };
    }).filter(stu => {
      // Search matching Filter
      const matchedSearch = stu.name.toLowerCase().includes(historySearch.toLowerCase()) || 
                            stu.rollNumber.toLowerCase().includes(historySearch.toLowerCase());
      
      if (!matchedSearch) return false;

      // Status filters
      if (historyFilterStatus === 'at-risk') {
        return stu.stats.total > 0 && stu.stats.rate < 80;
      }
      return true;
    });
  }, [students, sheets, historySearch, historyFilterStatus]);

  // CSV Generation Helper
  const downloadCSVReport = () => {
    if (students.length === 0 || sheets.length === 0) return;
    const sortedSheets = [...sheets].sort((a, b) => a.date.localeCompare(b.date));
    const dates = sortedSheets.map(s => s.date);
    
    let csvContent = "data:text/csv;charset=utf-8,";
    // Header
    csvContent += ["Roll Number", "Student Name", "Attendance Rate (%)", ...dates].join(",") + "\n";

    // Rows
    matrixData.forEach(row => {
      const rowArr = [
        row.rollNumber,
        `"${row.name.replace(/"/g, '""')}"`,
        `${row.stats.rate}%`,
        ...dates.map(d => {
          const statusObj = row.historyRows[d];
          return statusObj ? statusObj.status.toUpperCase() : "N/A";
        })
      ];
      csvContent += rowArr.join(",") + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `attendance_summary_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div id="application-layout" className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col font-sans">
      {/* Dynamic Toast Banner */}
      {banner && (
        <div 
          id="toast-notification"
          className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-5 py-4 rounded-xl shadow-lg border animate-in fade-in slide-in-from-top-4 duration-300 ${
            banner.type === 'success' 
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {banner.type === 'success' ? (
            <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />
          ) : (
            <AlertCircle className="h-5 w-5 text-rose-500 shrink-0" />
          )}
          <span className="text-sm font-medium">{banner.message}</span>
          <button 
            onClick={() => setBanner(null)} 
            className="p-1 hover:bg-black/5 rounded-md transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Main Structural Navbar */}
      <header id="app-header" className="sticky top-0 z-40 bg-white border-b border-slate-100 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          {/* Logo & Platform Info */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-brand-600 flex items-center justify-center text-white transition-colors duration-300 shadow-sm shadow-brand-500/20">
              <ClipboardCheck className="h-6 w-6" />
            </div>
            <div>
              <h1 className="font-bold text-lg text-slate-900 tracking-tight">RosterFlow</h1>
              <p className="text-[10px] uppercase tracking-widest font-bold text-brand-600 font-mono transition-colors duration-300">Attendance System</p>
            </div>
          </div>

          {/* Tab Navigation Center */}
          <nav className="hidden md:flex bg-slate-100 p-1 rounded-xl">
            <button
              id="tab-dashboard"
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                activeTab === 'dashboard'
                  ? 'bg-white text-brand-700 shadow-xs border border-brand-100'
                  : 'text-slate-600 hover:text-slate-950'
              }`}
            >
              <Sparkles className="h-4 w-4" />
              Overview
            </button>
            <button
              id="tab-attendance"
              onClick={() => setActiveTab('attendance')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                activeTab === 'attendance'
                  ? 'bg-white text-brand-700 shadow-xs border border-brand-100'
                  : 'text-slate-600 hover:text-slate-950'
              }`}
            >
              <ClipboardCheck className="h-4 w-4" />
              Conduct Roll Call
            </button>
            <button
              id="tab-students"
              onClick={() => setActiveTab('students')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                activeTab === 'students'
                  ? 'bg-white text-brand-700 shadow-xs border border-brand-100'
                  : 'text-slate-600 hover:text-slate-950'
              }`}
            >
              <Users className="h-4 w-4" />
              Students
            </button>
            <button
              id="tab-history"
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                activeTab === 'history'
                  ? 'bg-white text-brand-700 shadow-xs border border-brand-100'
                  : 'text-slate-600 hover:text-slate-950'
              }`}
            >
              <History className="h-4 w-4" />
              Logs & Tables
            </button>
          </nav>

          {/* Theme Switcher & Sync Unit */}
          <div className="flex items-center gap-3">
            {/* Elegant Theme Color Control Dots */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-100 p-1.5 rounded-xl">
              <button
                onClick={() => setAppTheme('indigo')}
                className={`w-4 h-4 rounded-full transition-all duration-250 cursor-pointer ${appTheme === 'indigo' ? 'ring-2 ring-violet-500 ring-offset-2 scale-110 shadow-xs' : 'opacity-50 hover:opacity-100'}`}
                style={{ backgroundColor: '#7c3aed' }}
                title="Royal Amethyst Theme"
              />
              <button
                onClick={() => setAppTheme('emerald')}
                className={`w-4 h-4 rounded-full transition-all duration-250 cursor-pointer ${appTheme === 'emerald' ? 'ring-2 ring-emerald-500 ring-offset-2 scale-110 shadow-xs' : 'opacity-50 hover:opacity-100'}`}
                style={{ backgroundColor: '#059669' }}
                title="Emerald Forest Theme"
              />
              <button
                onClick={() => setAppTheme('sunset')}
                className={`w-4 h-4 rounded-full transition-all duration-250 cursor-pointer ${appTheme === 'sunset' ? 'ring-2 ring-orange-500 ring-offset-2 scale-110 shadow-xs' : 'opacity-50 hover:opacity-100'}`}
                style={{ backgroundColor: '#ea580c' }}
                title="Sunset Amber Theme"
              />
              <button
                onClick={() => setAppTheme('slate')}
                className={`w-4 h-4 rounded-full transition-all duration-250 cursor-pointer ${appTheme === 'slate' ? 'ring-2 ring-slate-400 ring-offset-2 scale-110 shadow-xs' : 'opacity-50 hover:opacity-100'}`}
                style={{ backgroundColor: '#475569' }}
                title="Nordic Slate Theme"
              />
            </div>

            <div className="hidden lg:block text-right pr-1">
              <p className="text-[9px] uppercase font-bold tracking-wider text-slate-400">Term Block</p>
              <p className="text-xs text-slate-600 font-mono font-medium">June 2026</p>
            </div>
            <button 
              onClick={forceRefresh}
              disabled={loading}
              className="p-2 sm:px-3 sm:py-2 bg-slate-50 hover:bg-slate-100 text-slate-650 hover:text-slate-950 font-medium text-xs rounded-xl border border-slate-200/50 flex items-center gap-2 active:scale-95 transition"
              title="Synchronize memory states from SQLite backend"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Sync DB</span>
            </button>
          </div>
        </div>

        {/* Mobile Tab Layout */}
        <div className="md:hidden border-t border-slate-100 flex justify-around p-2 bg-white">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-col items-center gap-1 p-2 text-xs font-medium ${
              activeTab === 'dashboard' ? 'text-slate-950 stroke-2' : 'text-slate-400'
            }`}
          >
            <Sparkles className="h-4 w-4" />
            <span>Overview</span>
          </button>
          <button
            onClick={() => setActiveTab('attendance')}
            className={`flex flex-col items-center gap-1 p-2 text-xs font-medium ${
              activeTab === 'attendance' ? 'text-slate-950 stroke-2' : 'text-slate-400'
            }`}
          >
            <ClipboardCheck className="h-4 w-4" />
            <span>Mark</span>
          </button>
          <button
            onClick={() => setActiveTab('students')}
            className={`flex flex-col items-center gap-1 p-2 text-xs font-medium ${
              activeTab === 'students' ? 'text-slate-950 stroke-2' : 'text-slate-400'
            }`}
          >
            <Users className="h-4 w-4" />
            <span>Roster</span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex flex-col items-center gap-1 p-2 text-xs font-medium ${
              activeTab === 'history' ? 'text-slate-950 stroke-2' : 'text-slate-400'
            }`}
          >
            <History className="h-4 w-4" />
            <span>Logs</span>
          </button>
        </div>
      </header>

      {/* Main Container Elements */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {loading ? (
          <div id="full-page-loading" className="flex flex-col justify-center items-center h-96 space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-slate-900"></div>
            <p className="text-slate-500 text-sm font-medium">Connecting to persistent storage JSON engine...</p>
          </div>
        ) : (
          <>
            {/* TAB 1: DASHBOARD OVERVIEW */}
            {activeTab === 'dashboard' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Classroom Health Diagnostics</h2>
                  <p className="text-slate-500 text-sm">Real-time attendance analysis, status tallies, system trends, and roster overview metrics.</p>
                </div>
                <DashboardStats 
                  stats={stats} 
                  students={students} 
                  sheets={sheets} 
                  onNavigateToStudents={() => setActiveTab('students')}
                  onNavigateToMarker={handleQuickMarkToday}
                />
              </div>
            )}

            {/* TAB 2: CONDUCT ROLL CALL (MARK ATTENDANCE) */}
            {activeTab === 'attendance' && (
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">Active Daily Check-In Roll Call</h2>
                    <p className="text-slate-500 text-sm">Review credentials, select calendar dates, bulk mark present/absent states, and commit to memory logs.</p>
                  </div>

                  {/* Calendar Date Trigger */}
                  <div className="flex items-center gap-3 bg-white p-2 rounded-xl border border-slate-250 shadow-xs">
                    <span className="text-xs font-semibold text-slate-500 flex items-center gap-1 pl-2">
                      <Calendar className="h-3.5 w-3.5 text-slate-400" />
                      Session Date:
                    </span>
                    <input 
                      type="date" 
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="text-sm font-semibold text-slate-800 bg-slate-50 rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:ring-2 focus:ring-slate-950 font-mono cursor-pointer border border-slate-200"
                    />
                  </div>
                </div>

                {/* ⚡ Blazing Fast Power Tools Ribbon */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                  {/* Keyboard Powerups Infobox */}
                  <div className="lg:col-span-7 bg-brand-50/50 border border-brand-border rounded-2xl p-4 flex items-start gap-4 transition-all duration-300">
                    <div className="bg-brand-100 text-brand-700 h-9 w-9 rounded-xl flex items-center justify-center shrink-0 transition-colors duration-300">
                      <Keyboard className="h-5 w-5" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-xs font-bold text-brand-700 uppercase tracking-widest flex items-center gap-1.5 transition-colors duration-300">
                        ⚡ Roll Call Keyboard Shortcuts
                      </h4>
                      <p className="text-slate-650 text-xs leading-relaxed">
                        Hover a student or use arrows <kbd className="px-1 border border-slate-200 bg-white font-mono rounded font-bold text-[10px] text-slate-700 shadow-xs">↑</kbd> <kbd className="px-1 border border-slate-200 bg-white font-mono rounded font-bold text-[10px] text-slate-700 shadow-xs">↓</kbd> to select. Tap <kbd className="px-1 border border-brand-border bg-brand-50 text-brand-700 font-mono rounded font-bold text-[10px] shadow-xs">P</kbd> (Present), <kbd className="px-1 border border-brand-border bg-brand-50 text-brand-700 font-mono rounded font-bold text-[10px] shadow-xs">A</kbd> (Absent), <kbd className="px-1 border border-brand-border bg-brand-50 text-brand-700 font-mono rounded font-bold text-[10px] shadow-xs">L</kbd> (Late), or <kbd className="px-1 border border-brand-border bg-brand-50 text-brand-700 font-mono rounded font-bold text-[10px] shadow-xs">E</kbd> (Excused) to mark.
                      </p>
                    </div>
                  </div>

                  {/* ⚡ Quick Inline Student Addition */}
                  <form onSubmit={handleQuickEnroll} className="lg:col-span-5 bg-emerald-50/40 border border-emerald-100 rounded-2xl p-4 flex flex-col justify-between gap-1.5">
                    <div className="flex items-center gap-1.5 text-emerald-950">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      <h4 className="text-xs font-bold uppercase tracking-wider">
                        ⚡ Instant Enroll Student
                      </h4>
                    </div>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        placeholder="Type student name to fast enroll..."
                        value={quickName}
                        onChange={(e) => setQuickName(e.target.value)}
                        className="flex-1 text-xs px-3 py-1.5 bg-white border border-emerald-250 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-emerald-500 font-medium placeholder-emerald-450"
                      />
                      <button 
                        type="submit"
                        disabled={quickEnrolling || !quickName.trim()}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:pointer-events-none text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-all active:scale-95 whitespace-nowrap shrink-0"
                      >
                        {quickEnrolling ? (
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Plus className="h-3.5 w-3.5" />
                        )}
                        Enroll
                      </button>
                    </div>
                  </form>
                </div>

                {/* Main Marking Workspace */}
                {students.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center space-y-4">
                    <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-500">
                      <Users className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800">Your classroom roster is empty</h3>
                      <p className="text-slate-550 text-sm max-w-md mx-auto mt-1">To record daily coordinates and track records, you must register student names first.</p>
                    </div>
                    <button 
                      onClick={() => setActiveTab('students')}
                      className="px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 transition"
                    >
                      Go Register Students
                    </button>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
                    {/* Control Bar */}
                    <div className="p-4 bg-slate-50/50 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <p className="text-xs text-slate-500 font-medium">
                        Roster includes <strong className="text-slate-850 font-semibold">{students.length}</strong> active students
                      </p>
                      
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={handleToggleAllPresent}
                          className="px-3.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-750 text-xs font-semibold rounded-lg flex items-center gap-1.5 active:scale-95 transition"
                        >
                          <Check className="h-3.5 w-3.5 text-emerald-500" />
                          Toggle All {allPresentQuickTrigger ? 'Absent' : 'Present'}
                        </button>
                      </div>
                    </div>

                    {/* Marking Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50/20 text-slate-400 font-semibold uppercase text-[10px] tracking-wider border-b border-slate-100">
                            <th className="py-4 px-6">Roll &amp; Name</th>
                            <th className="py-4 px-6 text-center">Status Selection</th>
                            <th className="py-4 px-6">Check-in Notes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {students.map((student, index) => {
                            const record = localAttendance[student.id] || { status: 'present', notes: '' };
                            const isKeyboardActive = index === keyboardActiveIndex;
                            return (
                              <tr 
                                key={student.id} 
                                onMouseEnter={() => setKeyboardActiveIndex(index)}
                                className={`transition-all duration-150 relative ${
                                  isKeyboardActive 
                                    ? 'bg-brand-50/20 border-l-4 border-brand-600' 
                                    : 'hover:bg-slate-50/20'
                                }`}
                              >
                                {/* Roll & Name */}
                                <td className="py-4 px-6 relative">
                                  {isKeyboardActive && (
                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-brand-600"></div>
                                  )}
                                  <div className="flex items-center gap-3 pl-1">
                                    <div className={`h-10 w-10 text-slate-700 rounded-xl flex items-center justify-center font-bold text-sm tracking-tight border transition-colors ${isKeyboardActive ? 'bg-brand-100/50 border-brand-border text-brand-700 shadow-xs' : 'bg-slate-50 border-slate-200/50'}`}>
                                      {student.name.split(' ').map(n => n[0]).join('')}
                                    </div>
                                    <div>
                                      <h4 className="font-semibold text-slate-800 text-sm flex items-center gap-1.5 flex-wrap">
                                        <span>{student.name}</span>
                                        {isKeyboardActive && (
                                          <span className="inline-flex items-center gap-0.5 text-[10px] text-brand-700 font-bold bg-brand-100/60 border border-brand-border px-1 py-0.5 rounded font-mono animate-pulse">
                                            ⌨️ ACTIVE
                                          </span>
                                        )}
                                      </h4>
                                      <p className="text-[11px] text-slate-400 font-mono font-medium">{student.rollNumber}</p>
                                    </div>
                                  </div>
                                </td>

                                {/* Status Radio Toggles */}
                                <td className="py-4 px-6">
                                  <div className="flex items-center justify-center gap-2 min-w-80">
                                    {/* PRESENT */}
                                    <button 
                                      onClick={() => handleMarkStatus(student.id, 'present')}
                                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide border transition flex items-center gap-1 ${
                                        record.status === 'present'
                                          ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-bold shadow-xs'
                                          : 'bg-white border-slate-200 text-slate-550 hover:bg-slate-50'
                                      }`}
                                    >
                                      <span className={`h-1.5 w-1.5 rounded-full ${record.status === 'present' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}></span>
                                      Present
                                    </button>

                                    {/* LATE */}
                                    <button 
                                      onClick={() => handleMarkStatus(student.id, 'late')}
                                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide border transition flex items-center gap-1 ${
                                        record.status === 'late'
                                          ? 'bg-amber-50 border-amber-300 text-amber-800 font-bold shadow-xs'
                                          : 'bg-white border-slate-200 text-slate-550 hover:bg-slate-50'
                                      }`}
                                    >
                                      <span className={`h-1.5 w-1.5 rounded-full ${record.status === 'late' ? 'bg-amber-500 animate-pulse' : 'bg-slate-300'}`}></span>
                                      Late
                                    </button>

                                    {/* EXCUSED */}
                                    <button 
                                      onClick={() => handleMarkStatus(student.id, 'excused')}
                                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide border transition flex items-center gap-1 ${
                                        record.status === 'excused'
                                          ? 'bg-indigo-50 border-indigo-300 text-indigo-800 font-bold shadow-xs'
                                          : 'bg-white border-slate-200 text-slate-550 hover:bg-slate-50'
                                      }`}
                                    >
                                      <span className={`h-1.5 w-1.5 rounded-full ${record.status === 'excused' ? 'bg-indigo-500' : 'bg-slate-300'}`}></span>
                                      Excused
                                    </button>

                                    {/* ABSENT */}
                                    <button 
                                      onClick={() => handleMarkStatus(student.id, 'absent')}
                                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide border transition flex items-center gap-1 ${
                                        record.status === 'absent'
                                          ? 'bg-rose-50 border-rose-300 text-rose-800 font-bold shadow-xs'
                                          : 'bg-white border-slate-200 text-slate-550 hover:bg-slate-50'
                                      }`}
                                    >
                                      <span className={`h-1.5 w-1.5 rounded-full ${record.status === 'absent' ? 'bg-rose-500 animate-pulse' : 'bg-slate-300'}`}></span>
                                      Absent
                                    </button>
                                  </div>
                                </td>

                                {/* Remark Notes Text Input */}
                                <td className="py-4 px-6">
                                  <input 
                                    type="text"
                                    placeholder="Add reason/note..."
                                    value={record.notes || ''}
                                    onChange={(e) => handleRecordNoteChange(student.id, e.target.value)}
                                    className="w-full text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 p-2 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-slate-900 focus:bg-white placeholder-slate-400"
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Commit Save Action Bar */}
                    <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
                      <div className="text-xs text-slate-500 font-medium">
                        Make sure to review all entries before submitting to storage.
                      </div>

                      <button
                        onClick={handleSaveAttendance}
                        disabled={submittingAttendance}
                        className="px-6 py-2.5 bg-slate-950 hover:bg-slate-900 text-white rounded-xl text-sm font-semibold flex items-center gap-2 shadow-xs transition active:scale-95 disabled:opacity-70 disabled:pointer-events-none"
                      >
                        {submittingAttendance ? (
                          <>
                            <RefreshCw className="h-4 w-4 animate-spin" />
                            Locking Sheet...
                          </>
                        ) : (
                          <>
                            <FileCheck className="h-4 w-4" />
                            Lock &amp; Save Sheet
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: ROSTER STUDENT MANAGER */}
            {activeTab === 'students' && (
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">Student Enrollment Directory</h2>
                    <p className="text-slate-500 text-sm">Register new listings, execute profile updates, audit rolls, or release student nodes.</p>
                  </div>

                  <button 
                    onClick={handleOpenAddStudent}
                    className="self-start md:self-auto px-4 py-2.5 bg-slate-950 hover:bg-slate-900 text-white font-semibold text-sm rounded-xl flex items-center gap-2 active:scale-95 shadow-xs transition"
                  >
                    <UserPlus className="h-4 w-4" />
                    Enroll New Student
                  </button>
                </div>

                {/* Filter and Search Block */}
                <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="relative flex-1 max-w-lg">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input 
                      type="text"
                      placeholder="Search by student name, roll code, or email address..."
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      className="w-full text-sm placeholder-slate-400 text-slate-800 pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-slate-950 focus:bg-white transition"
                    />
                  </div>

                  <div className="text-xs text-slate-400 font-mono">
                    Showing {filteredStudents.length} of {students.length} registered entries
                  </div>
                </div>

                {/* Table Block */}
                {filteredStudents.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center space-y-4">
                    <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center mx-auto text-slate-400">
                      <HelpCircle className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800">No students match your criteria</h3>
                      <p className="text-slate-500 text-xs mt-1">Clear the keyword query or click "Add Student" above to insert a new roster record.</p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50/20 text-slate-400 font-semibold uppercase text-[10px] tracking-wider border-b border-slate-100">
                            <th className="py-4 px-6">Roll ID</th>
                            <th className="py-4 px-6">Student Bio details</th>
                            <th className="py-4 px-6">Description or notes</th>
                            <th className="py-4 px-6 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-55">
                          {filteredStudents.map((st) => (
                            <tr key={st.id} className="hover:bg-slate-50/20 transition-colors">
                              {/* Roll */}
                              <td className="py-4 px-6 font-mono font-semibold text-xs text-slate-900 tracking-tight">
                                <span className="bg-slate-100 text-slate-800 px-2 py-1 rounded">
                                  {st.rollNumber}
                                </span>
                              </td>

                              {/* Student Bio */}
                              <td className="py-4 px-6">
                                <div className="space-y-0.5">
                                  <h4 className="font-semibold text-slate-800 text-sm">{st.name}</h4>
                                  <p className="text-xs text-slate-400 font-mono">{st.email || 'No email attached'}</p>
                                </div>
                              </td>

                              {/* Description notes */}
                              <td className="py-4 px-6 text-xs text-slate-550 max-w-xs truncate">
                                {st.notes ? (
                                  <span className="text-slate-600 bg-slate-50 rounded-md px-2 py-1 leading-normal border border-slate-100 block truncate">
                                    {st.notes}
                                  </span>
                                ) : (
                                  <span className="text-slate-350 italic font-medium">– No description notes –</span>
                                )}
                              </td>

                              {/* Actions */}
                              <td className="py-4 px-6 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => handleOpenEditStudent(st)}
                                    className="p-1.5 bg-slate-50 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200/60 rounded-md transition"
                                    title="Edit student"
                                  >
                                    <Edit2 className="h-4.5 w-4.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteStudent(st.id, st.name)}
                                    className="p-1.5 bg-slate-50 text-slate-600 hover:text-rose-600 hover:bg-rose-50 border border-slate-200/60 rounded-md transition"
                                    title="Delete student"
                                  >
                                    <Trash2 className="h-4.5 w-4.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: CHRONOLOGICAL MATRIX SHEET LOOPS (LOGS & TABLES) */}
            {activeTab === 'history' && (
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">Chronological Attendance Matrix</h2>
                    <p className="text-slate-500 text-sm">Full student check-in history mapped vertically by student, horizontally across marked calendar sessions.</p>
                  </div>

                  <button 
                    onClick={downloadCSVReport}
                    disabled={students.length === 0 || sheets.length === 0}
                    className="self-start md:self-auto px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-xl flex items-center gap-2 active:scale-95 shadow-xs disabled:opacity-50 disabled:pointer-events-none transition"
                  >
                    CSV Spreadsheet Export
                  </button>
                </div>

                {/* Filters & Control Block */}
                <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center flex-1 max-w-xl">
                    {/* Search student */}
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                      <input 
                        type="text"
                        placeholder="Search student bio..."
                        value={historySearch}
                        onChange={(e) => setHistorySearch(e.target.value)}
                        className="w-full text-xs text-slate-800 pl-8.5 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-slate-900 focus:bg-white"
                      />
                    </div>

                    {/* Filter class profile */}
                    <select
                      value={historyFilterStatus}
                      onChange={(e) => setHistoryFilterStatus(e.target.value)}
                      className="text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 focus:outline-hidden focus:ring-1 focus:ring-slate-900 cursor-pointer"
                    >
                      <option value="all">Showing All Students</option>
                      <option value="at-risk">At Risk Only (&lt; 80%)</option>
                    </select>
                  </div>

                  <div className="text-[11px] font-semibold text-slate-400 font-mono tracking-tight text-right flex flex-wrap gap-x-4 gap-y-1 justify-end">
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-emerald-500"></span> Present (P)
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-amber-500"></span> Late (L)
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-indigo-505"></span> Excused (E)
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-rose-500"></span> Absent (A)
                    </span>
                  </div>
                </div>

                {/* Huge Matrix Grid Container */}
                {sheets.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center space-y-4">
                    <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center mx-auto text-slate-400">
                      <History className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800">No chronological sessions on file</h3>
                      <p className="text-slate-500 text-xs mt-1">Submit your first roll call session to see sheets populate dynamically.</p>
                    </div>
                    <button 
                      onClick={() => setActiveTab('attendance')}
                      className="px-4 py-2 bg-slate-950 text-white rounded-xl text-sm font-semibold hover:bg-slate-900 transition"
                    >
                      Mark Check-in Now
                    </button>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
                    <div className="overflow-x-auto custom-scrollbar">
                      <table className="w-full text-left border-collapse table-fixed select-none">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                            <th className="py-4 px-6 min-w-48 sticky left-0 bg-slate-50 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] w-48">Student Info</th>
                            <th className="py-4 px-6 text-center min-w-24 w-24">Rate (%)</th>
                            {/* Map distinct sheets dates */}
                            {[...sheets].sort((a,b)=>a.date.localeCompare(b.date)).map(sheet => (
                              <th key={sheet.date} className="py-4 px-4 text-center min-w-28 font-mono text-[10px] w-28">
                                <div className="space-y-0.5">
                                  <span>{sheet.date.substring(5)}</span>
                                  <span className="block text-[8px] text-slate-400 font-normal">
                                    {new Date(sheet.date).toLocaleDateString('en-US', { weekday: 'short' })}
                                  </span>
                                </div>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {matrixData.map((row) => (
                            <tr key={row.id} className="hover:bg-slate-50/30 transition-colors">
                              {/* Sticky Stu Bio */}
                              <td className="py-3.5 px-6 font-medium sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] flex items-center gap-2">
                                <div className="truncate">
                                  <h5 className="font-semibold text-slate-800 text-xs truncate" title={row.name}>
                                    {row.name}
                                  </h5>
                                  <p className="text-[10px] text-slate-400 font-mono tracking-tight">{row.rollNumber}</p>
                                </div>
                              </td>

                              {/* Rate */}
                              <td className="py-3.5 px-6 text-center">
                                <span className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded ${
                                  row.stats.rate >= 90 ? 'bg-emerald-50 text-emerald-700' :
                                  row.stats.rate >= 80 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'
                                }`}>
                                  {row.stats.rate}%
                                </span>
                              </td>

                              {/* Cells mapping dates key-values */}
                              {[...sheets].sort((a,b)=>a.date.localeCompare(b.date)).map(sheet => {
                                const statusValue = row.historyRows[sheet.date];
                                return (
                                  <td key={sheet.date} className="py-3.5 px-4 text-center">
                                    {statusValue ? (
                                      <div className="inline-flex flex-col items-center justify-center relative group">
                                        <span className={`h-6.5 w-6.5 text-[10px] rounded-full font-bold flex items-center justify-center border uppercase tracking-tight shadow-2xs ${
                                          statusValue.status === 'present' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
                                          statusValue.status === 'absent' ? 'bg-rose-50 border-rose-200 text-rose-800' :
                                          statusValue.status === 'late' ? 'bg-amber-50 border-amber-200 text-amber-800' :
                                          'bg-indigo-50 border-indigo-200 text-indigo-800'
                                        }`}>
                                          {statusValue.status === 'present' ? 'P' :
                                           statusValue.status === 'absent' ? 'A' :
                                           statusValue.status === 'late' ? 'L' : 'E'}
                                        </span>

                                        {/* Hover Notes Tooltip */}
                                        {statusValue.notes && (
                                          <div className="absolute hidden group-hover:block bottom-full left-1/2 -translate-x-1/2 mb-2 w-36 p-2 bg-slate-900 text-white text-[10px] rounded-lg shadow-md z-30 leading-snug break-words">
                                            {statusValue.notes}
                                            <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900"></span>
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-[10px] text-slate-300 font-mono">N/A</span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* Dynamic Modal overlays for Enrollment Adding/Editing */}
      {showAddStudentModal && (
        <div id="enrollment-modal" className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-950">
                  {editingStudent ? 'Modify Student Credentials' : 'Enroll New Classmate'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {editingStudent ? 'Update details securely stored in dataset.' : 'Registers a brand new student item on the database Roster.'}
                </p>
              </div>
              <button 
                onClick={() => setShowAddStudentModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 rounded-lg transition"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmitStudent} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Full Name *</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. John Doe"
                  value={studentForm.name}
                  onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })}
                  className="w-full text-sm font-semibold text-slate-8 w-full px-3.5 py-2.5 bg-slate-50 border border-slate-205 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-slate-950 focus:bg-white transition"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Email Address (Optional)</label>
                <input 
                  type="email" 
                  placeholder="e.g. j.doe@institution.edu"
                  value={studentForm.email}
                  onChange={(e) => setStudentForm({ ...studentForm, email: e.target.value })}
                  className="w-full text-sm px-3.5 py-2.5 bg-slate-50 border border-slate-205 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-slate-950 focus:bg-white transition"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Administrative notes (Optional)</label>
                <textarea 
                  placeholder="e.g. Needs front bench, Class representative, medical flag"
                  rows={3}
                  value={studentForm.notes}
                  onChange={(e) => setStudentForm({ ...studentForm, notes: e.target.value })}
                  className="w-full text-sm px-3.5 py-2.5 bg-slate-50 border border-slate-205 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-slate-950 focus:bg-white transition resize-none"
                />
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button 
                  type="button"
                  onClick={() => setShowAddStudentModal(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-655 hover:text-slate-950 bg-slate-50 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={submittingStudent}
                  className="px-5 py-2 bg-slate-950 hover:bg-slate-900 text-white rounded-xl text-sm font-semibold flex items-center gap-1.5 transition active:scale-95 disabled:opacity-75"
                >
                  {submittingStudent && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  Save Student
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer Details */}
      <footer id="app-footer" className="bg-white border-t border-slate-100 py-6 mt-12 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 RosterFlow. All rights reserved.</p>
          <div className="flex gap-4 font-medium text-[11px] text-slate-400">
            <span>Academic Registry Management</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

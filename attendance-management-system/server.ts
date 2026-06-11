import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { Student, AttendanceSheet, AttendanceStatus, DailyRecords } from './src/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Path to data file
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'attendance_store.json');

app.use(express.json());

// Ensure data directory exists and seed data if first boot of the container
function initializeDatabase() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  // Check if file exists, if not write initial seed data
  if (!fs.existsSync(DATA_FILE)) {
    const seedStudents: Student[] = [
      { id: 'stu_1', name: 'Liam Smith', rollNumber: 'STU001', email: 'liam.smith@school.edu', notes: 'Class Representative', createdAt: new Date(Date.now() - 100000000).toISOString() },
      { id: 'stu_2', name: 'Emma Johnson', rollNumber: 'STU002', email: 'emma.j@school.edu', notes: '', createdAt: new Date(Date.now() - 90000000).toISOString() },
      { id: 'stu_3', name: 'Noah Williams', rollNumber: 'STU003', email: 'noah.w@school.edu', notes: 'Needs permission for early leave on Fridays', createdAt: new Date(Date.now() - 80000000).toISOString() },
      { id: 'stu_4', name: 'Olivia Brown', rollNumber: 'STU004', email: 'olivia.b@school.edu', notes: '', createdAt: new Date(Date.now() - 70000000).toISOString() },
      { id: 'stu_5', name: 'James Jones', rollNumber: 'STU005', email: 'james.jones@school.edu', notes: '', createdAt: new Date(Date.now() - 60000000).toISOString() },
      { id: 'stu_6', name: 'Sophia Miller', rollNumber: 'STU006', email: 'sophia.m@school.edu', notes: 'Active in dance club', createdAt: new Date(Date.now() - 50000000).toISOString() },
      { id: 'stu_7', name: 'Jackson Davis', rollNumber: 'STU007', email: 'jackson.d@school.edu', notes: '', createdAt: new Date(Date.now() - 40000000).toISOString() },
      { id: 'stu_8', name: 'Isabella Garcia', rollNumber: 'STU008', email: 'isabella.g@school.edu', notes: 'Prefers front-row seating', createdAt: new Date(Date.now() - 30000000).toISOString() }
    ];

    // Seed attendance for the last 4 school days (excluding today, let's keep today un-marked initially for user interaction)
    const seedSheets: AttendanceSheet[] = [
      {
        date: '2026-06-08', // Monday
        records: {
          'stu_1': { status: 'present' },
          'stu_2': { status: 'present' },
          'stu_3': { status: 'absent', notes: 'Family emergency' },
          'stu_4': { status: 'present' },
          'stu_5': { status: 'late', notes: 'Missed school bus' },
          'stu_6': { status: 'present' },
          'stu_7': { status: 'present' },
          'stu_8': { status: 'excused', notes: 'Dental checkup' }
        },
        updatedAt: new Date(Date.now() - 4 * 24 * 3600000).toISOString()
      },
      {
        date: '2026-06-09', // Tuesday
        records: {
          'stu_1': { status: 'present' },
          'stu_2': { status: 'present' },
          'stu_3': { status: 'present' },
          'stu_4': { status: 'present' },
          'stu_5': { status: 'present' },
          'stu_6': { status: 'present' },
          'stu_7': { status: 'absent', notes: 'Unwell' },
          'stu_8': { status: 'present' }
        },
        updatedAt: new Date(Date.now() - 3 * 24 * 3600000).toISOString()
      },
      {
        date: '2026-06-10', // Wednesday
        records: {
          'stu_1': { status: 'present' },
          'stu_2': { status: 'late', notes: 'Traffic' },
          'stu_3': { status: 'present' },
          'stu_4': { status: 'present' },
          'stu_5': { status: 'present' },
          'stu_6': { status: 'absent', notes: 'Fever' },
          'stu_7': { status: 'present' },
          'stu_8': { status: 'present' }
        },
        updatedAt: new Date(Date.now() - 2 * 24 * 3600000).toISOString()
      },
      {
        date: '2026-06-11', // Thursday (today)
        records: {
          'stu_1': { status: 'present' },
          'stu_2': { status: 'present' },
          'stu_3': { status: 'present' },
          'stu_4': { status: 'present' },
          'stu_5': { status: 'present' },
          'stu_6': { status: 'present' },
          'stu_7': { status: 'present' },
          'stu_8': { status: 'present' }
        },
        updatedAt: new Date().toISOString()
      }
    ];

    const initialData = {
      students: seedStudents,
      sheets: seedSheets
    };

    fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2), 'utf-8');
    console.log('Seeded database successfully.');
  }
}

initializeDatabase();

// Database read helper
function readData(): { students: Student[]; sheets: AttendanceSheet[] } {
  try {
    const content = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    console.error('Error reading database file', err);
    return { students: [], sheets: [] };
  }
}

// Database write helper
function writeData(data: { students: Student[]; sheets: AttendanceSheet[] }): boolean {
  try {
    const tempFile = `${DATA_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempFile, DATA_FILE);
    return true;
  } catch (err) {
    console.error('Error writing database file', err);
    return false;
  }
}

// Helper to calculate statistics
function calculateStats(students: Student[], sheets: AttendanceSheet[]) {
  const totalStudents = students.length;
  const totalSheets = sheets.length;

  let totalPresent = 0;
  let totalAbsent = 0;
  let totalLate = 0;
  let totalExcused = 0;

  const studentStats: { [id: string]: any } = {};
  students.forEach(s => {
    studentStats[s.id] = {
      present: 0,
      absent: 0,
      late: 0,
      excused: 0,
      totalDays: 0,
      rate: 100
    };
  });

  sheets.forEach(sheet => {
    Object.entries(sheet.records).forEach(([studentId, record]) => {
      if (!studentStats[studentId]) {
        // Just in case student was deleted but record still exists
        return;
      }
      studentStats[studentId].totalDays += 1;
      
      switch (record.status) {
        case 'present':
          totalPresent++;
          studentStats[studentId].present++;
          break;
        case 'absent':
          totalAbsent++;
          studentStats[studentId].absent++;
          break;
        case 'late':
          totalLate++;
          studentStats[studentId].late++;
          break;
        case 'excused':
          totalExcused++;
          studentStats[studentId].excused++;
          break;
      }
    });
  });

  // Calculate percentages for students
  students.forEach(s => {
    const sStats = studentStats[s.id];
    if (sStats.totalDays > 0) {
      // (Present + Late + Excused) / TotalDays or does Late / Excused count as attended?
      // Let's count Present and Late as attended, Excused is excused but doesn't lower attendance percentage, Absent lowers attendance percentage.
      // Let's use standard formula: (Present + Late + Excused) / TotalDays * 100
      // Actually, standard: (Present + Late) / TotalDays * 100 or count Excused as attended
      const attended = sStats.present + sStats.late + sStats.excused;
      sStats.rate = sStats.totalDays > 0 ? Math.round((attended / sStats.totalDays) * 100) : 100;
    }
  });

  // Calculate rate by date
  const byDateStats: { [date: string]: any } = {};
  sheets.forEach(sheet => {
    let p = 0;
    let ab = 0;
    let l = 0;
    let ex = 0;
    
    Object.values(sheet.records).forEach(rec => {
      switch (rec.status) {
        case 'present': p++; break;
        case 'absent': ab++; break;
        case 'late': l++; break;
        case 'excused': ex++; break;
      }
    });

    const total = p + ab + l + ex;
    const rate = total > 0 ? Math.round(((p + l + ex) / total) * 100) : 100;

    byDateStats[sheet.date] = {
      date: sheet.date,
      present: p,
      absent: ab,
      late: l,
      excused: ex,
      total,
      rate
    };
  });

  const allRecordsCount = totalPresent + totalAbsent + totalLate + totalExcused;
  const overallAttendanceRate = allRecordsCount > 0 
    ? Math.round(((totalPresent + totalLate + totalExcused) / allRecordsCount) * 100) 
    : 100;

  return {
    totalStudents,
    totalSheets,
    overallAttendanceRate,
    statusCounts: {
      present: totalPresent,
      absent: totalAbsent,
      late: totalLate,
      excused: totalExcused
    },
    studentStats,
    byDateStats
  };
}

// REST API Endpoints

// 1. Get List of Students
app.get('/api/students', (req, res) => {
  const { students } = readData();
  res.json(students);
});

// 2. Add Student
app.post('/api/students', (req, res) => {
  const { name, email, notes } = req.body;
  if (!name || name.trim() === '') {
    res.status(400).json({ error: 'Student name is required.' });
    return;
  }

  const { students, sheets } = readData();

  // Generate roll number: find max existing roll number or start with 1
  let nextRollNum = 1;
  students.forEach(s => {
    const match = s.rollNumber.match(/\d+/);
    if (match) {
      const num = parseInt(match[0], 10);
      if (num >= nextRollNum) nextRollNum = num + 1;
    }
  });
  const rollNumber = `STU${String(nextRollNum).padStart(3, '0')}`;

  const newStudent: Student = {
    id: `stu_${Date.now()}`,
    name: name.trim(),
    rollNumber,
    email: email ? email.trim() : '',
    notes: notes ? notes.trim() : '',
    createdAt: new Date().toISOString()
  };

  students.push(newStudent);
  const success = writeData({ students, sheets });

  if (success) {
    res.status(201).json(newStudent);
  } else {
    res.status(500).json({ error: 'Failed to write data to storage.' });
  }
});

// 3. Edit Student
app.put('/api/students/:id', (req, res) => {
  const { id } = req.params;
  const { name, email, notes } = req.body;

  if (!name || name.trim() === '') {
    res.status(400).json({ error: 'Student name is required.' });
    return;
  }

  const { students, sheets } = readData();
  const studentIndex = students.findIndex(s => s.id === id);

  if (studentIndex === -1) {
    res.status(404).json({ error: 'Student not found.' });
    return;
  }

  students[studentIndex] = {
    ...students[studentIndex],
    name: name.trim(),
    email: email ? email.trim() : '',
    notes: notes ? notes.trim() : ''
  };

  const success = writeData({ students, sheets });

  if (success) {
    res.json(students[studentIndex]);
  } else {
    res.status(500).json({ error: 'Failed to update student in storage.' });
  }
});

// 4. Delete Student
app.delete('/api/students/:id', (req, res) => {
  const { id } = req.params;
  const { students, sheets } = readData();

  const studentIndex = students.findIndex(s => s.id === id);
  if (studentIndex === -1) {
    res.status(404).json({ error: 'Student not found.' });
    return;
  }

  // Remove student
  students.splice(studentIndex, 1);

  // Clean student's attendance records in existing sheets
  sheets.forEach(sheet => {
    if (sheet.records[id]) {
      delete sheet.records[id];
    }
  });

  const success = writeData({ students, sheets });

  if (success) {
    res.json({ message: 'Student and associated attendance records deleted successfully.' });
  } else {
    res.status(500).json({ error: 'Failed to delete student from storage.' });
  }
});

// 5. Get All Attendance Sheets
app.get('/api/attendance', (req, res) => {
  const { sheets } = readData();
  res.json(sheets);
});

// 6. Get Attendance by specific Date
app.get('/api/attendance/date/:date', (req, res) => {
  const { date } = req.params; // Expects YYYY-MM-DD
  const { sheets } = readData();

  const sheet = sheets.find(s => s.date === date);
  if (sheet) {
    res.json(sheet);
  } else {
    // Return empty template for that date
    res.json({ date, records: {}, isNew: true });
  }
});

// 7. Save/Update Attendance for a Date (Bulk Save)
app.post('/api/attendance', (req, res) => {
  const { date, records } = req.body; // records is layout studentId -> { status, notes }

  if (!date || !records) {
    res.status(400).json({ error: 'Date and records are required.' });
    return;
  }

  const { students, sheets } = readData();

  // Validate date format slightly
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    res.status(400).json({ error: 'Date must be of format YYYY-MM-DD.' });
    return;
  }

  // Find sheet or create new
  const index = sheets.findIndex(s => s.date === date);
  const updatedSheet: AttendanceSheet = {
    date,
    records,
    updatedAt: new Date().toISOString()
  };

  if (index !== -1) {
    sheets[index] = updatedSheet;
  } else {
    sheets.push(updatedSheet);
    // Sort sheets chronologically (ascending dates)
    sheets.sort((a, b) => a.date.localeCompare(b.date));
  }

  const success = writeData({ students, sheets });

  if (success) {
    res.json(updatedSheet);
  } else {
    res.status(500).json({ error: 'Failed to save attendance record.' });
  }
});

// 8. Get Statistics
app.get('/api/attendance/stats', (req, res) => {
  const { students, sheets } = readData();
  const stats = calculateStats(students, sheets);
  res.json(stats);
});

// Integrate Vite middleware for development or serve built assets in production
if (process.env.NODE_ENV !== 'production') {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else {
  const distPath = path.join(process.cwd(), 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on http://0.0.0.0:${PORT}`);
});

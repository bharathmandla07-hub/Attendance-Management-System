export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

export interface Student {
  id: string;
  name: string;
  rollNumber: string;
  email?: string;
  notes?: string;
  createdAt: string;
}

export interface AttendanceRecord {
  status: AttendanceStatus;
  notes?: string;
}

export interface DailyRecords {
  [studentId: string]: AttendanceRecord;
}

export interface AttendanceSheet {
  date: string; // YYYY-MM-DD
  records: DailyRecords;
  updatedAt: string;
}

export interface AttendanceStats {
  totalStudents: number;
  totalSheets: number;
  overallAttendanceRate: number; // percentage
  statusCounts: {
    present: number;
    absent: number;
    late: number;
    excused: number;
  };
  studentStats: {
    [studentId: string]: {
      present: number;
      absent: number;
      late: number;
      excused: number;
      totalDays: number;
      rate: number; // percentage
    };
  };
  byDateStats: {
    [date: string]: {
      date: string;
      present: number;
      absent: number;
      late: number;
      excused: number;
      total: number;
      rate: number;
    };
  };
}

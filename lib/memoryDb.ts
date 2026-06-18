// Simple in-memory database fallback to allow the application to run as a fully functional SaaS
// in local/in-memory mode if Supabase credentials are not provided.

export interface Subject {
  id: string;
  name: string;
  description: string;
  created_at: string;
}

export interface Chapter {
  id: string;
  subject_id: string;
  index: number;
  title: string;
  content_summary: string;
  raw_text_chunk: string;
  created_at: string;
}

export interface Worksheet {
  id: string;
  chapter_id: string;
  title: string;
  summary: string;
  created_at: string;
}

export interface WorksheetQuestion {
  id: string;
  worksheet_id: string;
  type: 'key_term' | 'fill_blank' | 'discussion';
  question_text: string;
  answer_text: string;
  created_at: string;
}

export interface Test {
  id: string;
  chapter_id: string;
  title: string;
  created_at: string;
}

export interface TestQuestion {
  id: string;
  test_id: string;
  question_text: string;
  options: string[];
  correct_index: number;
  explanation: string;
  created_at: string;
}

export interface StudentTestAttempt {
  id: string;
  test_id: string;
  score: number;
  max_score: number;
  selected_answers: number[];
  created_at: string;
}

interface InMemoryDB {
  subjects: Subject[];
  chapters: Chapter[];
  worksheets: Worksheet[];
  worksheet_questions: WorksheetQuestion[];
  tests: Test[];
  test_questions: TestQuestion[];
  student_test_attempts: StudentTestAttempt[];
}

const globalForDb = globalThis as unknown as {
  inMemoryDb: InMemoryDB | undefined;
};

if (!globalForDb.inMemoryDb) {
  globalForDb.inMemoryDb = {
    subjects: [],
    chapters: [],
    worksheets: [],
    worksheet_questions: [],
    tests: [],
    test_questions: [],
    student_test_attempts: [],
  };
}

export const inMemoryDb = globalForDb.inMemoryDb;

// Helper to generate UUIDs
export function generateUUID(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : 'mock-uuid-' + Math.random().toString(36).substring(2, 15);
}

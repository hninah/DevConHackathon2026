import type { ExamResult } from './types';
import type { Question } from './types';

const MOCK_EXAMS_KEY = 'securepass:mock-exams';
const MOCK_EXAM_RESULTS_KEY = 'securepass:mock-exam-results';

export type MockExamDefinition = {
  id: string;
  label: string;
  questionCount: number;
  durationSeconds: number;
  createdAt: number;
  source?: string;
  questions?: Question[];
};

export type StoredMockExamResult = ExamResult & {
  id: string;
  examId: string;
  examLabel: string;
  percentScore: number;
  questionOutcomes?: ExamQuestionOutcome[];
  questions?: Question[];
};

export type ExamQuestionOutcome = {
  questionId: string;
  questionNumber: number;
  wasCorrect: boolean;
};

const DEFAULT_EXAMS: MockExamDefinition[] = [
  {
    id: 'default-mock-exam',
    label: 'Mock Exam 1',
    questionCount: 50,
    durationSeconds: 60 * 60,
    createdAt: 0,
  },
];

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) {
    return fallback;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveMockExams(list: MockExamDefinition[]): void {
  window.localStorage.setItem(MOCK_EXAMS_KEY, JSON.stringify(list));
}

export function loadMockExams(): MockExamDefinition[] {
  const parsed = safeParse<MockExamDefinition[]>(window.localStorage.getItem(MOCK_EXAMS_KEY), []);
  if (!Array.isArray(parsed) || parsed.length === 0) {
    saveMockExams(DEFAULT_EXAMS);
    return DEFAULT_EXAMS;
  }
  return parsed;
}

export function loadMockExamById(id: string): MockExamDefinition | null {
  const exams = loadMockExams();
  return exams.find((exam) => exam.id === id) ?? null;
}

export function createMockExam(): MockExamDefinition {
  const existing = loadMockExams();
  const nextIndex = existing.length + 1;
  const next: MockExamDefinition = {
    id: `mock-exam-${crypto.randomUUID()}`,
    label: `Mock Exam ${nextIndex}`,
    questionCount: 50,
    durationSeconds: 60 * 60,
    createdAt: Date.now(),
  };
  const updated = [...existing, next];
  saveMockExams(updated);
  return next;
}

export function upsertMockExam(exam: MockExamDefinition): MockExamDefinition {
  const existing = loadMockExams();
  const others = existing.filter((item) => item.id !== exam.id);
  const updated = [exam, ...others];
  saveMockExams(updated);
  return exam;
}

export function loadMockExamResults(): StoredMockExamResult[] {
  const parsed = safeParse<StoredMockExamResult[]>(
    window.localStorage.getItem(MOCK_EXAM_RESULTS_KEY),
    [],
  );
  return Array.isArray(parsed) ? parsed : [];
}

export function saveMockExamResult(
  result: ExamResult,
  examId: string,
  examLabel: string,
  questionOutcomes?: ExamQuestionOutcome[],
  questions?: Question[],
): StoredMockExamResult {
  const payload: StoredMockExamResult = {
    ...result,
    id: `exam-result-${crypto.randomUUID()}`,
    examId,
    examLabel,
    percentScore: Math.round((result.score / result.total) * 100),
    questionOutcomes,
    questions,
  };
  const updated = [payload, ...loadMockExamResults()].slice(0, 30);
  window.localStorage.setItem(MOCK_EXAM_RESULTS_KEY, JSON.stringify(updated));
  return payload;
}

export function loadMockExamResultById(id: string): StoredMockExamResult | null {
  return loadMockExamResults().find((entry) => entry.id === id) ?? null;
}

export function getLatestMockExamResult(): StoredMockExamResult | null {
  const [latest] = loadMockExamResults();
  return latest ?? null;
}

import type { Question } from '../lib/types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.toString().trim().replace(/\/$/, '') ?? '';
const TUTOR_API_URL = import.meta.env.VITE_TUTOR_API_URL?.toString().trim() ?? '';
const MOCK_EXAM_API_URL = import.meta.env.VITE_MOCK_EXAM_API_URL?.toString().trim() ?? '';

function getMockExamCreateUrl(): string {
  if (MOCK_EXAM_API_URL) {
    return MOCK_EXAM_API_URL;
  }
  if (API_BASE_URL) {
    return `${API_BASE_URL}/mock-exams/create`;
  }
  if (TUTOR_API_URL) {
    return TUTOR_API_URL;
  }
  return '';
}

export type BackendMockExamPayload = {
  id: string;
  label: string;
  questionCount: number;
  durationSeconds: number;
  createdAt: number;
  source?: string;
  questions: Question[];
};

export async function createBackendMockExam(label?: string): Promise<BackendMockExamPayload> {
  const url = getMockExamCreateUrl();
  if (!url) {
    throw new Error('Backend URL is not configured.');
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      label,
      question_count: 50,
      _route: '/mock-exams/create',
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    let message = `Mock exam creation failed: ${response.status}`;
    try {
      const parsed = JSON.parse(errText) as { error?: string };
      if (parsed.error) {
        message = `${message}: ${parsed.error}`;
      }
    } catch {
      if (errText) {
        message = `${message} ${errText.slice(0, 200)}`;
      }
    }
    throw new Error(message);
  }

  return response.json() as Promise<BackendMockExamPayload>;
}

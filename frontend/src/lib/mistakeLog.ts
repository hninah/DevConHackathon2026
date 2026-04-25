import type { MistakeEntry } from './types';

const MISTAKES_KEY = 'securepass:mistakes';
const ATTEMPTS_KEY = 'securepass:attempts';

export type AttemptEntry = {
  questionId: string;
  module: string;
  wasCorrect: boolean;
  timestamp: number;
};

function safeParseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) {
    return fallback;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function loadMistakes(): MistakeEntry[] {
  const value = safeParseJson<unknown[]>(window.localStorage.getItem(MISTAKES_KEY), []);
  return Array.isArray(value) ? (value as MistakeEntry[]) : [];
}

export function saveMistake(entry: MistakeEntry): void {
  const current = loadMistakes();
  current.unshift(entry);
  window.localStorage.setItem(MISTAKES_KEY, JSON.stringify(current));
}

export function clearMistakes(): void {
  window.localStorage.removeItem(MISTAKES_KEY);
}

export function loadAttempts(): AttemptEntry[] {
  const value = safeParseJson<unknown[]>(window.localStorage.getItem(ATTEMPTS_KEY), []);
  return Array.isArray(value) ? (value as AttemptEntry[]) : [];
}

export function recordAttempt(entry: AttemptEntry): void {
  const current = loadAttempts();
  current.unshift(entry);
  window.localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(current));
}

export function clearAttempts(): void {
  window.localStorage.removeItem(ATTEMPTS_KEY);
}

export function getMistakesByModule(): Record<string, MistakeEntry[]> {
  const grouped: Record<string, MistakeEntry[]> = {};
  for (const mistake of loadMistakes()) {
    grouped[mistake.module] ??= [];
    grouped[mistake.module].push(mistake);
  }
  return grouped;
}

export function getAttemptsByModule(): Record<string, AttemptEntry[]> {
  const grouped: Record<string, AttemptEntry[]> = {};
  for (const attempt of loadAttempts()) {
    grouped[attempt.module] ??= [];
    grouped[attempt.module].push(attempt);
  }
  return grouped;
}

export function clearAllPracticeHistory(): void {
  clearMistakes();
  clearAttempts();
}


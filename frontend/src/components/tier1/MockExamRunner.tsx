import { useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import type { ExamResult, MistakeEntry, Question } from '../../lib/types';
import { saveMockExamResult, type ExamQuestionOutcome } from '../../lib/mockExamStorage';
import { recordAttempt, saveMistake } from '../../lib/mistakeLog';

type Phase = 'start' | 'in_progress' | 'results';

const DEFAULT_TOTAL_QUESTIONS = 50;
const DEFAULT_DURATION_SECONDS = 60 * 60;

function formatTime(seconds: number): string {
  const clamped = Math.max(0, seconds);
  const mm = Math.floor(clamped / 60)
    .toString()
    .padStart(2, '0');
  const ss = Math.floor(clamped % 60)
    .toString()
    .padStart(2, '0');
  return `${mm}:${ss}`;
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pickExamQuestions(all: Question[], totalQuestions: number): Question[] {
  const mcqOnly = all.filter((q) => q.type === 'mcq');
  return shuffle(mcqOnly).slice(0, Math.min(totalQuestions, mcqOnly.length));
}

function isAnswerCorrect(selected: number | null, correctAnswers: number[]): boolean {
  if (selected === null) {
    return false;
  }
  return correctAnswers.length === 1 && correctAnswers[0] === selected;
}

type MockExamRunnerProps = {
  examId?: string;
  examLabel?: string;
  totalQuestions?: number;
  durationSeconds?: number;
  presetQuestions?: Question[];
  onSubmitted?: (resultId: string) => void;
  autoStartOnEntry?: boolean;
};

function MockExamRunner({
  examId = 'default-mock-exam',
  examLabel = 'Mock Exam',
  totalQuestions = DEFAULT_TOTAL_QUESTIONS,
  durationSeconds = DEFAULT_DURATION_SECONDS,
  presetQuestions,
  onSubmitted,
  autoStartOnEntry = false,
}: MockExamRunnerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);

  const [phase, setPhase] = useState<Phase>('start');
  const [examQuestions, setExamQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [answers, setAnswers] = useState<Record<string, number | null>>({});

  const [timeLeft, setTimeLeft] = useState(durationSeconds);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [result, setResult] = useState<ExamResult | null>(null);
  const [isSubmitConfirmOpen, setIsSubmitConfirmOpen] = useState(false);
  const didAutoPromptRef = useRef(false);

  const current = examQuestions[currentIndex];

  const answeredCount = useMemo(() => {
    return examQuestions.reduce((count, q) => {
      const value = answers[q.id];
      return value === null || value === undefined ? count : count + 1;
    }, 0);
  }, [answers, examQuestions]);

  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<void> {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch('/question-bank.json');
        if (!response.ok) {
          throw new Error(`Failed to load question bank (${response.status}).`);
        }
        const data = (await response.json()) as Question[];
        if (!cancelled) {
          setAllQuestions(data);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Load failed.');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (phase !== 'in_progress') {
      return;
    }
    const handle = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(handle);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(handle);
  }, [phase]);

  useEffect(() => {
    if (phase === 'in_progress' && timeLeft === 0) {
      submitExam();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, phase]);

  useEffect(() => {
    if (!autoStartOnEntry || isLoading || Boolean(error) || phase !== 'start' || didAutoPromptRef.current) {
      return;
    }
    didAutoPromptRef.current = true;
    startExam();
  }, [autoStartOnEntry, examLabel, error, isLoading, phase]);

  function startExam(): void {
    const picked =
      presetQuestions && presetQuestions.length > 0
        ? presetQuestions.slice(0, totalQuestions)
        : pickExamQuestions(allQuestions, totalQuestions);
    if (picked.length < totalQuestions) {
      setError(
        `Need at least ${totalQuestions} MCQ questions; found ${picked.length}.`,
      );
      return;
    }
    setExamQuestions(picked);
    setCurrentIndex(0);
    setFlagged(new Set());
    const initialAnswers: Record<string, number | null> = {};
    for (const q of picked) {
      initialAnswers[q.id] = null;
    }
    setAnswers(initialAnswers);
    setTimeLeft(durationSeconds);
    setStartedAt(Date.now());
    setResult(null);
    setPhase('in_progress');
  }

  function toggleFlag(): void {
    if (!current) {
      return;
    }
    setFlagged((prev) => {
      const next = new Set(prev);
      if (next.has(current.id)) {
        next.delete(current.id);
      } else {
        next.add(current.id);
      }
      return next;
    });
  }

  function setAnswer(optionIndex: number): void {
    if (!current) {
      return;
    }
    setAnswers((prev) => ({
      ...prev,
      [current.id]: optionIndex,
    }));
  }

  function goTo(index: number): void {
    setCurrentIndex(Math.max(0, Math.min(index, examQuestions.length - 1)));
  }

  function submitExam(): void {
    if (phase !== 'in_progress') {
      return;
    }

    let score = 0;
    const mistakes: MistakeEntry[] = [];
    const outcomes: ExamQuestionOutcome[] = [];

    for (let idx = 0; idx < examQuestions.length; idx += 1) {
      const q = examQuestions[idx];
      const selected = answers[q.id] ?? null;
      const correct = isAnswerCorrect(selected, q.correctAnswers);
      outcomes.push({
        questionId: q.id,
        questionNumber: idx + 1,
        wasCorrect: correct,
      });

      recordAttempt({
        questionId: q.id,
        module: q.module,
        wasCorrect: correct,
        timestamp: Date.now(),
      });

      if (correct) {
        score += 1;
        continue;
      }

      const mistake: MistakeEntry = {
        questionId: q.id,
        module: q.module,
        selectedAnswers: selected === null ? [] : [selected],
        correctAnswers: q.correctAnswers,
        timestamp: Date.now(),
      };
      saveMistake(mistake);
      mistakes.push(mistake);
    }

    const completedAt = Date.now();
    const secondsTaken =
      startedAt === null ? undefined : Math.round((completedAt - startedAt) / 1000);
    const passed = score / examQuestions.length >= 0.8;

    const examResult: ExamResult = {
      score,
      total: examQuestions.length,
      passed,
      mistakes,
      completedAt,
      secondsTaken,
    };
    const saved = saveMockExamResult(examResult, examId, examLabel, outcomes, examQuestions);
    if (onSubmitted) {
      onSubmitted(saved.id);
      return;
    }
    setResult(examResult);
    setPhase('results');
  }

  function requestStartExam(): void {
    startExam();
  }

  function requestSubmitExam(): void {
    setIsSubmitConfirmOpen(true);
  }

  if (isLoading) {
    return (
      <section className="feature-card">
        <p className="feature-id">F3</p>
        <h3>Mock Exam Mode</h3>
        <p>Loading question bank…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="feature-card">
        <p className="feature-id">F3</p>
        <h3>Mock Exam Mode</h3>
        <p className="error">{error}</p>
      </section>
    );
  }

  if (phase === 'start') {
    return (
      <section className="feature-card">
        <p className="feature-id">F3</p>
        <h3>Mock Exam Mode</h3>
        <p>
          {totalQuestions} questions • {Math.round(durationSeconds / 60)} minutes • 80% to pass
        </p>
        <Button onClick={requestStartExam} type="button">
          Start {examLabel.toLowerCase()}
        </Button>
      </section>
    );
  }

  if (phase === 'results' && result) {
    const percentScore = Math.round((result.score / result.total) * 100);
    return (
      <section className="feature-card exam-results">
        <p className="feature-id">F3</p>
        <h3>Mock Exam Results</h3>
        <div className={result.passed ? 'pass-banner' : 'fail-banner'}>
          {result.passed ? 'Pass' : 'Not yet'} — {result.score}/{result.total} (
          {percentScore}%)
        </div>
        <p>
          Time: {result.secondsTaken ? formatTime(result.secondsTaken) : 'n/a'} •
          Explanations are shown in simplified English.
        </p>

        <Button onClick={() => setPhase('start')} type="button">
          Back to start
        </Button>

        <div className="exam-wrong-list">
          <h4>Review mistakes ({result.mistakes.length})</h4>
          {result.mistakes.length === 0 ? (
            <p>No mistakes logged. Great job.</p>
          ) : (
            <ol className="mistake-list">
              {result.mistakes.map((mistake) => {
                const q = examQuestions.find((item) => item.id === mistake.questionId);
                if (!q) {
                  return null;
                }
                const selectedIndex = mistake.selectedAnswers[0];
                const selectedText =
                  selectedIndex === undefined ? 'No answer' : q.options[selectedIndex];
                const correctText = q.options[q.correctAnswers[0]];

                return (
                  <li className="mistake-entry" key={mistake.timestamp}>
                    <p className="mistake-question">{q.question}</p>
                    <p>
                      <strong>Your answer:</strong> {selectedText}
                      <br />
                      <strong>Correct answer:</strong> {correctText}
                    </p>
                    <div className="explanation-block">
                      <p className="explanation-title">Explanation</p>
                      <p>{q.explanation}</p>
                      <details className="citation-block">
                        <summary>See citation (page {q.citation.page_number})</summary>
                        <pre>{q.citation.chunk_text}</pre>
                      </details>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </section>
    );
  }

  // in_progress
  if (!current) {
    return null;
  }

  const selected = answers[current.id] ?? null;
  const isFlagged = flagged.has(current.id);

  return (
    <>
      <section className="feature-card exam-card">
        <p className="feature-id">F3</p>
        <div className="exam-header">
          <h3>Mock Exam</h3>
          <div className="timer-pill exam-timer">{formatTime(timeLeft)}</div>
        </div>

        <div className="exam-meta">
          <span>
            Question {currentIndex + 1}/{examQuestions.length}
          </span>
          <span>
            Answered: {answeredCount}/{examQuestions.length}
          </span>
        </div>

        <p className="quiz-question">{current.question}</p>

        <div className="quiz-options">
          {current.options.map((option, optionIndex) => {
            const checked = selected === optionIndex;
            const className = checked ? 'quiz-option selected' : 'quiz-option';
            return (
              <label className={className} key={option}>
                <input
                  checked={checked}
                  name={`me-${current.id}`}
                  onChange={() => setAnswer(optionIndex)}
                  type="radio"
                />
                <span>{option}</span>
              </label>
            );
          })}
        </div>

        <div className="exam-actions">
          <Button
            onClick={() => goTo(currentIndex - 1)}
            disabled={currentIndex === 0}
            variant="secondary"
            type="button"
          >
            Previous
          </Button>
          <Button
            className={isFlagged ? 'flag-button flagged' : 'flag-button'}
            onClick={toggleFlag}
            variant={isFlagged ? 'primary' : 'secondary'}
            type="button"
          >
            {isFlagged ? 'Flagged' : 'Flag for review'}
          </Button>
          <Button
            onClick={() => goTo(currentIndex + 1)}
            disabled={currentIndex === examQuestions.length - 1}
            variant="secondary"
            type="button"
          >
            Next
          </Button>
        </div>

        <div className="exam-grid">
          {examQuestions.map((q, idx) => {
            const value = answers[q.id];
            const answered = value !== null && value !== undefined;
            const cellFlagged = flagged.has(q.id);
            let className = 'exam-cell';
            if (idx === currentIndex) {
              className += ' active';
            }
            if (answered) {
              className += ' answered';
            }
            if (cellFlagged) {
              className += ' flagged';
            }
            return (
              <button
                className={className}
                key={q.id}
                onClick={() => goTo(idx)}
                type="button"
              >
                {idx + 1}
              </button>
            );
          })}
        </div>

        <div className="exam-submit">
          <Button onClick={requestSubmitExam} type="button">
            Submit exam
          </Button>
        </div>
      </section>

      <Dialog open={isSubmitConfirmOpen} onOpenChange={setIsSubmitConfirmOpen}>
        <DialogContent aria-describedby="submit-exam-description">
          <DialogHeader>
            <DialogTitle>Submit exam now?</DialogTitle>
            <DialogDescription id="submit-exam-description">
              You cannot change answers after submitting this attempt.
            </DialogDescription>
          </DialogHeader>
          <div className="dialog-actions">
            <Button variant="secondary" onClick={() => setIsSubmitConfirmOpen(false)} type="button">
              Cancel
            </Button>
            <Button
              onClick={() => {
                setIsSubmitConfirmOpen(false);
                submitExam();
              }}
              type="button"
            >
              Submit exam
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default MockExamRunner;

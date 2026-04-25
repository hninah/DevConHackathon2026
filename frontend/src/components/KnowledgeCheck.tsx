import { useEffect, useMemo, useState } from 'react';

import type { MistakeEntry, Question } from '../lib/types';
import { recordAttempt, saveMistake } from '../lib/mistakeLog';

type KnowledgeCheckProps = {
  initialModule?: string;
  questionCount?: number;
  onDone?: () => void;
};

type Status = 'unanswered' | 'submitted';

function arraysEqualAsSets(a: number[], b: number[]): boolean {
  const aSet = new Set(a);
  const bSet = new Set(b);
  if (aSet.size !== bSet.size) {
    return false;
  }
  for (const value of aSet) {
    if (!bSet.has(value)) {
      return false;
    }
  }
  return true;
}

function percent(score: number, total: number): number {
  return total <= 0 ? 0 : Math.round((score / total) * 100);
}

function getDisplayQuestion(question: Question, simplifiedOn: boolean): string {
  if (!simplifiedOn) {
    return question.question;
  }
  return question.simplified?.trim() ? question.simplified : question.question;
}

function KnowledgeCheck({
  initialModule,
  questionCount = 20,
  onDone,
}: KnowledgeCheckProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);

  const modules = useMemo(() => {
    const set = new Set(allQuestions.map((q) => q.module).filter(Boolean));
    return ['All', ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [allQuestions]);

  const [selectedModule, setSelectedModule] = useState<string>(
    initialModule ?? 'All',
  );
  const [useSimplified, setUseSimplified] = useState(false);

  const questionSet = useMemo(() => {
    const filtered =
      selectedModule === 'All'
        ? allQuestions
        : allQuestions.filter((q) => q.module === selectedModule);

    const shuffled = [...filtered];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled.slice(0, Math.min(questionCount, shuffled.length));
  }, [allQuestions, questionCount, selectedModule]);

  const [index, setIndex] = useState(0);
  const [status, setStatus] = useState<Status>('unanswered');
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>([]);
  const [score, setScore] = useState(0);
  const [mistakes, setMistakes] = useState<MistakeEntry[]>([]);
  const [showSummary, setShowSummary] = useState(false);

  const current = questionSet[index];

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
    setIndex(0);
    setStatus('unanswered');
    setSelectedAnswers([]);
    setScore(0);
    setMistakes([]);
    setShowSummary(false);
  }, [selectedModule, questionCount]);

  function toggleAnswer(optionIndex: number): void {
    if (status === 'submitted') {
      return;
    }
    if (!current) {
      return;
    }
    if (current.type === 'mcq') {
      setSelectedAnswers([optionIndex]);
      return;
    }
    setSelectedAnswers((prev) =>
      prev.includes(optionIndex)
        ? prev.filter((value) => value !== optionIndex)
        : [...prev, optionIndex],
    );
  }

  function submit(): void {
    if (!current) {
      return;
    }
    if (selectedAnswers.length === 0) {
      return;
    }

    const isCorrect = arraysEqualAsSets(selectedAnswers, current.correctAnswers);
    setStatus('submitted');

    recordAttempt({
      questionId: current.id,
      module: current.module,
      wasCorrect: isCorrect,
      timestamp: Date.now(),
    });

    if (isCorrect) {
      setScore((prev) => prev + 1);
      return;
    }

    const mistake: MistakeEntry = {
      questionId: current.id,
      module: current.module,
      selectedAnswers,
      correctAnswers: current.correctAnswers,
      timestamp: Date.now(),
    };
    saveMistake(mistake);
    setMistakes((prev) => [mistake, ...prev]);
  }

  function next(): void {
    if (index + 1 >= questionSet.length) {
      setShowSummary(true);
      return;
    }
    setIndex((prev) => prev + 1);
    setStatus('unanswered');
    setSelectedAnswers([]);
  }

  function restart(): void {
    setIndex(0);
    setStatus('unanswered');
    setSelectedAnswers([]);
    setScore(0);
    setMistakes([]);
    setShowSummary(false);
  }

  if (isLoading) {
    return (
      <section className="mode-panel">
        <div className="primary-card">
          <p className="eyebrow">Knowledge check</p>
          <h2>Loading question bank…</h2>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="mode-panel">
        <div className="primary-card">
          <p className="eyebrow">Knowledge check</p>
          <h2>Could not load questions</h2>
          <p className="error">{error}</p>
        </div>
      </section>
    );
  }

  if (!questionSet.length) {
    return (
      <section className="mode-panel">
        <div className="primary-card">
          <p className="eyebrow">Knowledge check</p>
          <h2>No questions available</h2>
          <p>
            Pick a different module or regenerate <code>question-bank.json</code>.
          </p>
        </div>
      </section>
    );
  }

  if (showSummary) {
    const total = questionSet.length;
    const scorePercent = percent(score, total);
    const passed = scorePercent >= 80;

    return (
      <section className="mode-panel">
        <div className="primary-card">
          <p className="eyebrow">Knowledge check</p>
          <h2>Summary</h2>
          <div className={passed ? 'pass-banner' : 'fail-banner'}>
            {passed ? 'Pass' : 'Not yet'} — {score}/{total} ({scorePercent}%)
          </div>
          <p>
            Explanations are always in simplified English. Use citations to verify
            facts in the manual.
          </p>
          <div className="quiz-actions">
            <button onClick={restart} type="button">
              Try again
            </button>
            {onDone && (
              <button onClick={onDone} type="button">
                Back to Practice menu
              </button>
            )}
          </div>
        </div>

        <section className="primary-card">
          <h3>Mistakes ({mistakes.length})</h3>
          {mistakes.length === 0 ? (
            <p>No mistakes logged for this run.</p>
          ) : (
            <ol className="mistake-list">
              {mistakes.map((mistake) => {
                const question = questionSet.find((q) => q.id === mistake.questionId);
                if (!question) {
                  return null;
                }
                return (
                  <li className="mistake-entry" key={mistake.timestamp}>
                    <p className="mistake-question">{question.question}</p>
                    <div className="explanation-block">
                      <p className="explanation-title">Explanation</p>
                      <p>{question.explanation}</p>
                      <details className="citation-block">
                        <summary>See citation (page {question.citation.page_number})</summary>
                        <pre>{question.citation.chunk_text}</pre>
                      </details>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </section>
    );
  }

  if (!current) {
    return null;
  }

  const total = questionSet.length;
  const questionNumber = index + 1;
  const progressPercent = Math.round((questionNumber / total) * 100);

  const isSubmitted = status === 'submitted';
  const isCorrect = isSubmitted
    ? arraysEqualAsSets(selectedAnswers, current.correctAnswers)
    : false;
  const wrongSelections = isSubmitted
    ? selectedAnswers.filter((answer) => !current.correctAnswers.includes(answer))
    : [];

  return (
    <section className="mode-panel">
      <div className="primary-card quiz-container">
        <p className="eyebrow">Knowledge check</p>
        <div className="quiz-topbar">
          <label className="field">
            Module
            <select
              value={selectedModule}
              onChange={(event) => setSelectedModule(event.target.value)}
            >
              {modules.map((module) => (
                <option key={module} value={module}>
                  {module}
                </option>
              ))}
            </select>
          </label>
          <button
            className="simplified-toggle"
            onClick={() => setUseSimplified((prev) => !prev)}
            type="button"
          >
            {useSimplified ? 'Simplified English: ON' : 'Simplified English: OFF'}
          </button>
        </div>

        <div className="quiz-progress">
          <div className="quiz-progress-meta">
            <span>
              Question {questionNumber} / {total}
            </span>
            <span>{progressPercent}%</span>
          </div>
          <div className="quiz-progress-bar">
            <div
              className="quiz-progress-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {current.image ? (
          <img alt="Scenario" className="quiz-image" src={current.image} />
        ) : null}

        <h2 className="quiz-question">
          {getDisplayQuestion(current, useSimplified)}
        </h2>

        <div className="quiz-options">
          {current.options.map((option, optionIndex) => {
            const isSelected = selectedAnswers.includes(optionIndex);
            const isCorrectOption = current.correctAnswers.includes(optionIndex);

            let className = 'quiz-option';
            if (isSelected) {
              className += ' selected';
            }
            if (isSubmitted) {
              if (isCorrectOption) {
                className += ' correct';
              } else if (isSelected && !isCorrectOption) {
                className += ' wrong';
              }
            }

            return (
              <label className={className} key={option}>
                <input
                  checked={isSelected}
                  disabled={isSubmitted}
                  name={`kc-${current.id}`}
                  onChange={() => toggleAnswer(optionIndex)}
                  type={current.type === 'mcq' ? 'radio' : 'checkbox'}
                />
                <span>{option}</span>
              </label>
            );
          })}
        </div>

        {!isSubmitted ? (
          <div className="quiz-actions">
            <button
              disabled={selectedAnswers.length === 0}
              onClick={submit}
              type="button"
            >
              Submit
            </button>
          </div>
        ) : (
          <div className="quiz-feedback">
            <div className={isCorrect ? 'pass-banner' : 'fail-banner'}>
              {isCorrect ? 'Correct' : 'Incorrect'}
            </div>
            {!isCorrect && wrongSelections.length > 0 ? (
              <div className="explanation-block">
                <p className="explanation-title">Why your choice is wrong</p>
                <ul className="wrong-reasons">
                  {wrongSelections.map((optionIndex) => {
                    const option = current.options[optionIndex] ?? '';
                    const specific =
                      current.wrongAnswerExplanations?.[optionIndex] ?? null;
                    const fallback =
                      current.type === 'mcq'
                        ? 'This option does not match the manual definition for the term in the question.'
                        : 'This option is not one of the correct selections for this question.';
                    return (
                      <li key={`${current.id}-${optionIndex}`}>
                        <strong>{option}</strong>
                        <br />
                        {specific ?? fallback}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
            <div className="explanation-block">
              <p className="explanation-title">Explanation</p>
              <p>{current.explanation}</p>
              <details className="citation-block">
                <summary>See citation (page {current.citation.page_number})</summary>
                <pre>{current.citation.chunk_text}</pre>
              </details>
            </div>
            <div className="quiz-actions">
              <button onClick={next} type="button">
                {questionNumber === total ? 'Finish' : 'Next'}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default KnowledgeCheck;


import { useEffect, useState } from 'react';

import type { Question } from '../lib/types';
import {
  clearAllPracticeHistory,
  getMistakesByModule,
  loadMistakes,
} from '../lib/mistakeLog';

type MistakeLogProps = {
  onPracticeModule?: (module: string) => void;
};

function MistakeLog({ onPracticeModule }: MistakeLogProps) {
  const mistakes = loadMistakes();
  const grouped = getMistakesByModule();
  const modules = Object.keys(grouped).sort((a, b) => a.localeCompare(b));

  async function handleClear(): Promise<void> {
    const ok = window.confirm('Clear mistake log and practice history?');
    if (!ok) {
      return;
    }
    clearAllPracticeHistory();
    window.location.reload();
  }

  async function loadQuestions(): Promise<Question[]> {
    const response = await fetch('/question-bank.json');
    if (!response.ok) {
      return [];
    }
    return (await response.json()) as Question[];
  }

  if (!mistakes.length) {
    return (
      <section className="mode-panel">
        <div className="primary-card">
          <p className="eyebrow">Mistake log</p>
          <h2>No mistakes yet</h2>
          <p>
            Your wrong answers will appear here with citations, so you can revise the
            exact manual pages.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="mode-panel">
      <div className="primary-card">
        <p className="eyebrow">Mistake log</p>
        <h2>Review and re-practice</h2>
        <p>
          Explanations are always in simplified English. Use citations to verify
          facts in the manual.
        </p>
        <div className="quiz-actions">
          <button onClick={() => void handleClear()} type="button">
            Clear log
          </button>
        </div>
      </div>

      <div className="primary-card">
        <h3>By module</h3>
        {modules.map((module) => (
          <section className="mistake-group" key={module}>
            <div className="mistake-group-header">
              <h4>
                {module} ({grouped[module].length})
              </h4>
              {onPracticeModule && (
                <button onClick={() => onPracticeModule(module)} type="button">
                  Practice this module
                </button>
              )}
            </div>

            <ModuleMistakes module={module} loadQuestions={loadQuestions} />
          </section>
        ))}
      </div>
    </section>
  );
}

function ModuleMistakes({
  module,
  loadQuestions,
}: {
  module: string;
  loadQuestions: () => Promise<Question[]>;
}) {
  const moduleMistakes = getMistakesByModule()[module] ?? [];
  const [questions, setQuestions] = useState<Question[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<void> {
      const items = await loadQuestions();
      if (!cancelled) {
        setQuestions(items);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [loadQuestions]);

  if (!questions) {
    return <p>Loading…</p>;
  }

  return (
    <ol className="mistake-list">
      {moduleMistakes.map((mistake) => {
        const q = questions.find((item) => item.id === mistake.questionId);
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
  );
}

export default MistakeLog;


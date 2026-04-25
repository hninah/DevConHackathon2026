import { useMemo, useState } from 'react';

import KnowledgeCheck from './KnowledgeCheck';
import MistakeLog from './MistakeLog';
import MockExamRunner from './tier1/MockExamRunner';
import ModuleHeatmap from './tier1/ModuleHeatmap';
import SvgScenario from './tier1/SvgScenario';
import { loadMistakes } from '../lib/mistakeLog';

function PracticeMode() {
  const [view, setView] = useState<'menu' | 'knowledge-check' | 'mock-exam' | 'mistake-log'>(
    'menu',
  );
  const [moduleForPractice, setModuleForPractice] = useState<string | undefined>(
    undefined,
  );

  const mistakeCount = useMemo(() => loadMistakes().length, []);

  if (view === 'knowledge-check') {
    return (
      <section className="mode-panel">
        <div className="primary-card">
          <p className="eyebrow">Practice mode</p>
          <h2>Knowledge checks</h2>
          <div className="quiz-actions">
            <button onClick={() => setView('menu')} type="button">
              Back
            </button>
          </div>
        </div>
        <KnowledgeCheck
          initialModule={moduleForPractice}
          onDone={() => setView('menu')}
        />
      </section>
    );
  }

  if (view === 'mock-exam') {
    return (
      <section className="mode-panel">
        <div className="primary-card">
          <p className="eyebrow">Practice mode</p>
          <h2>Mock exam</h2>
          <div className="quiz-actions">
            <button onClick={() => setView('menu')} type="button">
              Back
            </button>
          </div>
        </div>
        <div className="feature-grid">
          <MockExamRunner />
        </div>
      </section>
    );
  }

  if (view === 'mistake-log') {
    return (
      <section className="mode-panel">
        <div className="primary-card">
          <p className="eyebrow">Practice mode</p>
          <h2>Mistake log</h2>
          <div className="quiz-actions">
            <button onClick={() => setView('menu')} type="button">
              Back
            </button>
          </div>
        </div>
        <MistakeLog
          onPracticeModule={(module) => {
            setModuleForPractice(module);
            setView('knowledge-check');
          }}
        />
      </section>
    );
  }

  return (
    <section className="mode-panel">
      <div className="primary-card">
        <p className="eyebrow">Practice mode</p>
        <h2>Exam-format practice</h2>
        <p>
          Knowledge Checks let you toggle Simplified English for the question text.
          Explanations are always simplified English with manual citations.
        </p>
      </div>
      <div className="feature-grid">
        <section className="feature-card">
          <p className="feature-id">KC</p>
          <h3>Knowledge Checks</h3>
          <p>MCQ + select-all with simplified English explanations + citations.</p>
          <button
            onClick={() => {
              setModuleForPractice(undefined);
              setView('knowledge-check');
            }}
            type="button"
          >
            Start knowledge checks
          </button>
        </section>

        <section className="feature-card">
          <p className="feature-id">EX</p>
          <h3>Mock Exam</h3>
          <p>Timed 50-question exam in English only. 80% required to pass.</p>
          <button onClick={() => setView('mock-exam')} type="button">
            Start mock exam
          </button>
        </section>

        <section className="feature-card">
          <p className="feature-id">ML</p>
          <h3>Mistake Log</h3>
          <p>Review wrong answers with citation blocks, then re-practice modules.</p>
          <button onClick={() => setView('mistake-log')} type="button">
            Open mistake log{mistakeCount ? ` (${mistakeCount})` : ''}
          </button>
        </section>
      </div>

      <div className="feature-grid">
        <ModuleHeatmap />
        <SvgScenario />
      </div>
    </section>
  );
}

export default PracticeMode;

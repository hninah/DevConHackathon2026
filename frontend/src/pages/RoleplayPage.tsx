import { useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Square, SquareDot } from 'lucide-react';

type View = 'roleplay' | 'summary';
type Mode = 'passive' | 'active';

type Choice = {
  key: 'A' | 'B' | 'C';
  text: string;
  correct: boolean;
  correctFeedback: string;
  wrongFeedback: string;
};

type ScenarioQuestion = {
  id: string;
  type: string;
  text: string;
  choices: Choice[];
};

type BackendScenario = {
  module: string;
  scenario_title: string;
  image_prompt: string;
  dialogue: Array<{ speaker: string; text: string }>;
  questions: ScenarioQuestion[];
  citations: Array<{ page_number: number }>;
};

const moduleOptions = [
  { id: 'all', label: 'All modules' },
  { id: 'Module 01', label: 'Module 01' },
  { id: 'Module 02', label: 'Module 02' },
  { id: 'Module 03', label: 'Module 03' },
  { id: 'Module 04', label: 'Module 04' },
  { id: 'Module 05', label: 'Module 05' },
];
const scenarioOptions = [
  'Perimeter suspicious movement',
  'After-hours entry attempt',
  'Retail theft observation',
];

const FALLBACK_SCENARIO: BackendScenario = {
  module: 'All modules',
  scenario_title: 'Fallback roleplay scenario',
  image_prompt:
    'Security guard observing a person near a restricted gate at night with cameras visible.',
  dialogue: [
    { speaker: 'Dispatch', text: 'Confirm your position and keep visual tracking.' },
    { speaker: 'Officer A', text: 'Observed suspect near service entry door.' },
    { speaker: 'Officer B', text: 'Copy. Camera is live from east corridor.' },
    { speaker: 'Suspect', text: 'I am waiting for someone to open this door.' },
  ],
  questions: [
    {
      id: 'q1',
      type: 'Sequence · communication first',
      text: 'What should the guard do first?',
      choices: [
        {
          key: 'A',
          text: 'Confront the person alone immediately.',
          correct: false,
          correctFeedback: '',
          wrongFeedback: 'Why this matters: report and assess safely first.',
        },
        {
          key: 'B',
          text: 'Notify dispatch with location and behavior details.',
          correct: true,
          correctFeedback: 'Why this works: communication first builds safe coordination.',
          wrongFeedback: '',
        },
        {
          key: 'C',
          text: 'Leave the area and come back later.',
          correct: false,
          correctFeedback: '',
          wrongFeedback: 'Why this matters: do not abandon post during active observation.',
        },
      ],
    },
    {
      id: 'q2',
      type: 'Decision · suspect engagement',
      text: 'Suspect moves toward restricted access. Best next action?',
      choices: [
        {
          key: 'A',
          text: 'Keep distance and continue updates.',
          correct: true,
          correctFeedback: 'Why this works: safe monitoring and communication reduce risk.',
          wrongFeedback: '',
        },
        {
          key: 'B',
          text: 'Use force right away.',
          correct: false,
          correctFeedback: '',
          wrongFeedback: 'Why this matters: force is not first response unless immediate danger exists.',
        },
        {
          key: 'C',
          text: 'Move silently with lights off.',
          correct: false,
          correctFeedback: '',
          wrongFeedback: 'Why this matters: poor visibility can increase danger and confusion.',
        },
      ],
    },
    {
      id: 'q3',
      type: 'Closure · reporting quality',
      text: 'What must be in the incident report?',
      choices: [
        {
          key: 'A',
          text: 'Only a final opinion.',
          correct: false,
          correctFeedback: '',
          wrongFeedback: 'Why this matters: reports need factual sequence and details.',
        },
        {
          key: 'B',
          text: 'Time, place, observations, communications, and actions.',
          correct: true,
          correctFeedback: 'Why this works: complete facts support legal and training review.',
          wrongFeedback: '',
        },
        {
          key: 'C',
          text: 'No report if nobody is arrested.',
          correct: false,
          correctFeedback: '',
          wrongFeedback: 'Why this matters: non-arrest incidents still need documentation.',
        },
      ],
    },
  ],
  citations: [],
};

export default function RoleplayPage() {
  const [currentView, setCurrentView] = useState<View>('roleplay');
  const [mode, setMode] = useState<Mode>('passive');
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);
  const [results, setResults] = useState<Array<boolean | null>>([null, null, null]);
  const [moduleChoice, setModuleChoice] = useState(moduleOptions[0].id);
  const [scenarioChoice, setScenarioChoice] = useState(scenarioOptions[0]);
  const [seed, setSeed] = useState(11);
  const [todoChecked, setTodoChecked] = useState([false, false, false]);
  const [scenario, setScenario] = useState<BackendScenario>(FALLBACK_SCENARIO);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const question = scenario.questions[currentQuestion] ?? scenario.questions[0];
  const score = results.filter(Boolean).length;
  const stepCount = scenario.questions.length;

  useEffect(() => {
    let canceled = false;

    async function fetchScenario(): Promise<void> {
      setIsLoading(true);
      setLoadError(null);
      try {
        const base = import.meta.env.VITE_API_BASE_URL ?? '';
        if (!base) {
          setScenario(FALLBACK_SCENARIO);
          return;
        }

        const response = await fetch(`${base}/roleplay`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode,
            module: moduleChoice,
            scenario_hint: scenarioChoice,
            top_k: 6,
          }),
        });

        if (!response.ok) {
          throw new Error(`Roleplay request failed: ${response.status}`);
        }

        const payload = (await response.json()) as BackendScenario;
        if (!canceled) {
          const nextScenario =
            payload.questions && payload.questions.length > 0 ? payload : FALLBACK_SCENARIO;
          setScenario(nextScenario);
          setCurrentQuestion(0);
          setAnswered(false);
          setSelectedChoice(null);
          setResults(new Array(nextScenario.questions.length).fill(null));
        }
      } catch (error) {
        if (!canceled) {
          setScenario(FALLBACK_SCENARIO);
          setLoadError(error instanceof Error ? error.message : 'Failed to load scenario.');
        }
      } finally {
        if (!canceled) setIsLoading(false);
      }
    }

    fetchScenario();
    return () => {
      canceled = true;
    };
  }, [mode, moduleChoice, scenarioChoice]);

  function switchMode(nextMode: Mode): void {
    setMode(nextMode);
    setCurrentQuestion(0);
    setAnswered(false);
    setSelectedChoice(null);
    setResults(new Array(stepCount).fill(null));
  }

  function chooseAnswer(index: number): void {
    if (answered) return;
    const isCorrect = question.choices[index].correct;
    const next = [...results];
    next[currentQuestion] = isCorrect;
    setSelectedChoice(index);
    setResults(next);
    setAnswered(true);
  }

  function restartScenario(): void {
    setCurrentQuestion(0);
    setAnswered(false);
    setSelectedChoice(null);
    setResults(new Array(stepCount).fill(null));
  }

  function nextPart(): void {
    if (!answered) return;
    if (currentQuestion === stepCount - 1) {
      setCurrentView('summary');
      return;
    }
    setCurrentQuestion((prev) => prev + 1);
    setAnswered(false);
    setSelectedChoice(null);
  }

  function toggleTodo(index: number): void {
    const next = [...todoChecked];
    next[index] = !next[index];
    setTodoChecked(next);
  }

  const citationPages = useMemo(
    () => Array.from(new Set(scenario.citations.map((item) => item.page_number))).slice(0, 4),
    [scenario.citations],
  );

  return (
    <section className="h-[calc(100vh-120px)] overflow-hidden rounded-xl border border-[#d9cdb9] bg-[#f7f1e6]">
      <header className="flex h-16 items-center justify-between border-b border-[#d9cdb9] bg-[#fffdf8] px-5">
        <nav className="flex items-center gap-2 text-sm">
          <button
            type="button"
            onClick={() => setCurrentView('roleplay')}
            className={`rounded-full px-3 py-2 ${
              currentView === 'roleplay'
                ? 'bg-[#1b2950] text-white'
                : 'text-[#1b2950] hover:bg-[#ede2d0]'
            }`}
          >
            Roleplay Lab
          </button>
          <button
            type="button"
            onClick={() => setCurrentView('summary')}
            className={`rounded-full px-3 py-2 ${
              currentView === 'summary'
                ? 'bg-[#1b2950] text-white'
                : 'text-[#1b2950] hover:bg-[#ede2d0]'
            }`}
          >
            Summary
          </button>
        </nav>
      </header>

      <main className="h-[calc(100%-64px)] overflow-auto p-5">
        {currentView === 'roleplay' ? (
          <div className="flex h-full flex-col gap-4">
            <section className="rounded-xl bg-[#1b2950] p-4 text-white">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="m-0 text-xl font-semibold">Scenario Lab</h2>
                  <p className="mt-1 text-sm text-[#d8e3ff]">
                    RAG-based scenario from the security manual with simplified feedback.
                  </p>
                </div>
                <span className="rounded-full bg-[#2f4a85] px-3 py-1 text-xs font-semibold tracking-wide">
                  {scenario.module.toUpperCase()}
                </span>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => switchMode('passive')}
                  className={`rounded-md px-3 py-2 text-sm ${
                    mode === 'passive' ? 'bg-white text-[#1b2950]' : 'bg-[#2f4a85] text-white'
                  }`}
                >
                  Thief perspective
                </button>
                <button
                  type="button"
                  onClick={() => switchMode('active')}
                  className={`rounded-md px-3 py-2 text-sm ${
                    mode === 'active' ? 'bg-white text-[#1b2950]' : 'bg-[#2f4a85] text-white'
                  }`}
                >
                  Officer perspective
                </button>
              </div>
            </section>

            <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <select
                value={moduleChoice}
                onChange={(event) => setModuleChoice(event.target.value)}
                className="h-11 rounded-md border border-[#d9cdb9] bg-[#fffdf8] px-3 text-sm font-medium text-[#15223f] outline-none focus:ring-2 focus:ring-[#2f4a85]"
              >
                {moduleOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
              <select
                value={scenarioChoice}
                onChange={(event) => setScenarioChoice(event.target.value)}
                className="h-11 rounded-md border border-[#d9cdb9] bg-[#fffdf8] px-3 text-sm font-medium text-[#15223f] outline-none focus:ring-2 focus:ring-[#2f4a85]"
              >
                {scenarioOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </section>

            <section className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[1fr_1.1fr]">
              <div className="grid min-h-0 gap-4">
                <article className="rounded-xl bg-[#15223f] p-4 text-[#e8efff]">
                  <p className="m-0 text-xs uppercase tracking-wide text-[#9fb5e6]">AI Scene Prompt</p>
                  <p className="mt-2 text-sm">
                    {scenario.image_prompt}
                  </p>
                  <div className="mt-3 rounded-md border border-dashed border-[#5a74ab] bg-[#1e2e52] p-4 text-sm">
                    Placeholder image area matching prompt context
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs text-[#b7c7e8]">Variation seed: {seed}</span>
                    <button
                      type="button"
                      onClick={() => setSeed((prev) => prev + 1)}
                      className="rounded-md bg-white px-3 py-2 text-xs font-medium text-[#1b2950]"
                    >
                      Regenerate image
                    </button>
                  </div>
                </article>

                <article className="rounded-xl bg-[#15223f] p-4 text-[#e8efff]">
                  <p className="m-0 text-xs uppercase tracking-wide text-[#9fb5e6]">AI Dialogue</p>
                  <div className="mt-3 space-y-2 text-sm">
                    {scenario.dialogue.map((line) => {
                      const borderColor =
                        line.speaker === 'Dispatch'
                          ? 'border-[#7cb3ff]'
                          : line.speaker.includes('Officer A')
                            ? 'border-[#9de2b6]'
                            : line.speaker.includes('Officer B')
                              ? 'border-[#f8d38d]'
                              : 'border-[#ff9fa1]';
                      return (
                        <div key={`${line.speaker}-${line.text}`} className={`border-l-4 pl-3 ${borderColor}`}>
                          <strong>{line.speaker}:</strong> {line.text}
                        </div>
                      );
                    })}
                  </div>
                </article>
              </div>

              <article className="flex min-h-0 flex-col rounded-xl border border-[#d9cdb9] bg-[#fffdf8]">
                <header className="border-b border-[#e6dccb] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="rounded-full bg-[#ede2d0] px-3 py-1 text-xs font-semibold text-[#1b2950]">
                      {question.type}
                    </span>
                    <span className="text-xs font-medium text-[#41506f]">
                      Step {currentQuestion + 1} of {stepCount}
                    </span>
                  </div>
                  <div className="mt-2 flex gap-1">
                    {scenario.questions.map((_, idx) => {
                      const done = idx < currentQuestion;
                      const now = idx === currentQuestion;
                      return done ? (
                        <SquareDot key={idx} size={14} className="text-[#1b2950]" />
                      ) : now ? (
                        <Square key={idx} size={14} className="fill-[#1b2950] text-[#1b2950]" />
                      ) : (
                        <Square key={idx} size={14} className="text-[#9ca8c2]" />
                      );
                    })}
                  </div>
                </header>

                <div className="min-h-0 flex-1 overflow-auto p-4">
                  <p className="text-base font-semibold text-[#15223f]">{question.text}</p>
                  <div className="mt-4 space-y-2">
                    {question.choices.map((choice, index) => {
                      const isSelected = selectedChoice === index;
                      const revealCorrect = answered && choice.correct;
                      const isWrongSelected = answered && isSelected && !choice.correct;
                      const shouldDim = answered && !isSelected && !choice.correct;

                      let rowClass =
                        'border-[#d9cdb9] bg-white text-[#15223f] hover:border-[#2f4a85] cursor-pointer';
                      if (revealCorrect) rowClass = 'border-[#78c49a] bg-[#eefcf3] text-[#145a33]';
                      if (isWrongSelected) rowClass = 'border-[#e79c9e] bg-[#fff1f1] text-[#7f1d20]';
                      if (shouldDim) rowClass += ' opacity-60';

                      return (
                        <button
                          key={choice.key}
                          type="button"
                          onClick={() => chooseAnswer(index)}
                          className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition ${rowClass}`}
                        >
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-[#edf2ff] text-xs font-bold text-[#1b2950]">
                            {choice.key}
                          </span>
                          <span className="text-sm">{choice.text}</span>
                        </button>
                      );
                    })}
                  </div>

                  {answered && selectedChoice !== null ? (
                    <div
                      className={`mt-4 rounded-lg border p-3 text-sm ${
                        question.choices[selectedChoice].correct
                          ? 'border-[#78c49a] bg-[#eefcf3] text-[#145a33]'
                          : 'border-[#e79c9e] bg-[#fff1f1] text-[#7f1d20]'
                      }`}
                    >
                      <p className="m-0 font-semibold">
                        {question.choices[selectedChoice].correct ? 'Why this works' : 'Why this matters'}
                      </p>
                      <p className="mt-1">
                        {question.choices[selectedChoice].correct
                          ? question.choices[selectedChoice].correctFeedback
                          : question.choices[selectedChoice].wrongFeedback}
                      </p>
                    </div>
                  ) : null}

                  {loadError ? (
                    <p className="mt-3 rounded-md border border-[#f0b0ad] bg-[#fff1f1] p-2 text-xs text-[#7f1d20]">
                      Backend error: {loadError}. Showing fallback scenario.
                    </p>
                  ) : null}
                </div>

                <footer className="flex items-center justify-between border-t border-[#e6dccb] p-4">
                  <button
                    type="button"
                    onClick={restartScenario}
                    className="rounded-md border border-[#d9cdb9] px-3 py-2 text-sm text-[#41506f]"
                  >
                    Restart
                  </button>
                  <button
                    type="button"
                    disabled={!answered}
                    onClick={nextPart}
                    className="rounded-md bg-[#1b2950] px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {currentQuestion === stepCount - 1 ? 'See summary →' : 'Next part →'}
                  </button>
                </footer>
              </article>
            </section>

            {isLoading ? (
              <div className="inline-flex items-center gap-2 text-sm text-[#41506f]">
                <Loader2 size={16} className="animate-spin" />
                Loading scenario from backend RAG...
              </div>
            ) : null}

            {citationPages.length ? (
              <p className="text-xs text-[#41506f]">
                Source pages: {citationPages.join(', ')}
              </p>
            ) : null}
          </div>
        ) : null}

        {currentView === 'summary' ? (
          <div className="space-y-4">
            <section className="rounded-xl bg-[#1b2950] p-5 text-white">
              <div className="flex flex-wrap items-center gap-5">
                <div className="inline-flex h-24 w-24 items-center justify-center rounded-full border-4 border-[#7fa2e7] text-2xl font-bold">
                  {score}/{stepCount}
                </div>
                <div>
                  <h2 className="m-0 text-xl font-semibold">Session complete</h2>
                  <p className="mt-1 text-sm text-[#d8e3ff]">
                    You completed {scenario.module} scenario practice in{' '}
                    {mode === 'active' ? 'Officer perspective' : 'Thief perspective'} mode.
                  </p>
                </div>
              </div>
            </section>

            <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <article className="rounded-xl border border-[#d9cdb9] bg-[#fffdf8] p-4">
                <h3 className="m-0 text-base font-semibold text-[#15223f]">Modules to review</h3>
                <div className="mt-3 space-y-3">
                  {[
                    { module: 'Module 02 · Communication', rate: 72, level: 'High' },
                    { module: 'Module 03 · Engagement', rate: 46, level: 'Review' },
                    { module: 'Module 05 · Reporting', rate: 18, level: 'OK' },
                  ].map((row) => (
                    <div key={row.module} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-[#15223f]">{row.module}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            row.level === 'High'
                              ? 'bg-[#fee2e2] text-[#991b1b]'
                              : row.level === 'Review'
                                ? 'bg-[#fef3c7] text-[#92400e]'
                                : 'bg-[#dcfce7] text-[#166534]'
                          }`}
                        >
                          {row.level}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-[#ede2d0]">
                        <div
                          className={`h-full ${
                            row.level === 'High'
                              ? 'bg-[#dc2626]'
                              : row.level === 'Review'
                                ? 'bg-[#d97706]'
                                : 'bg-[#16a34a]'
                          }`}
                          style={{ width: `${row.rate}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </article>

              <article className="rounded-xl border border-[#d9cdb9] bg-[#fffdf8] p-4">
                <h3 className="m-0 text-base font-semibold text-[#15223f]">Review to-do list</h3>
                <div className="mt-3 space-y-2">
                  {[
                    { text: 'Re-read Module 02 §4', tag: 'Module 02', time: '10 min' },
                    { text: 'Practice Q3 to Q5 in Exam Practice', tag: 'Exam Practice', time: '15 min' },
                    { text: 'Replay scenario in active mode', tag: 'Roleplay', time: '12 min' },
                  ].map((task, index) => (
                    <button
                      key={task.text}
                      type="button"
                      onClick={() => toggleTodo(index)}
                      className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left ${
                        todoChecked[index]
                          ? 'border-[#8fc6a7] bg-[#effcf3]'
                          : 'border-[#d9cdb9] bg-white hover:border-[#2f4a85]'
                      }`}
                    >
                      <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded border border-[#b8c8e6]">
                        {todoChecked[index] ? <Check size={13} className="text-[#166534]" /> : null}
                      </span>
                      <span className="flex-1">
                        <span className="block text-sm font-medium text-[#15223f]">{task.text}</span>
                        <span className="mt-1 inline-flex items-center gap-2 text-xs text-[#41506f]">
                          <span className="rounded-full bg-[#ede2d0] px-2 py-0.5">{task.tag}</span>
                          <span>{task.time}</span>
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </article>
            </section>

            <button
              type="button"
              onClick={() => setCurrentView('roleplay')}
              className="rounded-md bg-[#1b2950] px-4 py-2 text-sm text-white"
            >
              Start new scenario →
            </button>
          </div>
        ) : null}
      </main>
    </section>
  );
}

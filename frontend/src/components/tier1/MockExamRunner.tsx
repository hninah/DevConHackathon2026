import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../ui/card';
import Progress from '../ui/progress';
import { loadDashboardData, saveDashboardData } from '../../lib/dashboardStorage';
import type { MistakeItem } from '../../lib/dashboardStorage';

type ExamChoice = { id: string; text: string; isCorrect: boolean };
type ExamQuestion = { id: string; prompt: string; module: string; citation: string; choices: ExamChoice[] };
type AnswerMap = Record<string, string>;

const EXAM_DURATION_SEC = 25 * 60;
const PASS_MARK = 80;

const EXAM_QUESTIONS: ExamQuestion[] = [
  {
    id: 'uof1', module: 'Use of Force and De-escalation', citation: 'Manual page 43',
    prompt: 'A suspect verbally threatens a guard but has not moved. What is the correct first response?',
    choices: [
      { id: 'a', text: 'Issue clear verbal commands and maintain safe distance.', isCorrect: true },
      { id: 'b', text: 'Immediately apply physical restraint.', isCorrect: false },
      { id: 'c', text: 'Walk away and file a report only.', isCorrect: false },
      { id: 'd', text: 'Call police and take no action until they arrive.', isCorrect: false },
    ],
  },
  {
    id: 'uof2', module: 'Use of Force and De-escalation', citation: 'Manual page 43',
    prompt: 'Under which condition is physical restraint clearly justified?',
    choices: [
      { id: 'a', text: 'Suspect is walking slowly through a restricted zone.', isCorrect: false },
      { id: 'b', text: 'Suspect refuses to provide identification.', isCorrect: false },
      { id: 'c', text: 'Suspect is actively assaulting another person.', isCorrect: true },
      { id: 'd', text: 'Suspect is speaking in a loud voice.', isCorrect: false },
    ],
  },
  {
    id: 'uof3', module: 'Use of Force and De-escalation', citation: 'Manual page 88',
    prompt: 'After any use-of-force incident, what documentation is required?',
    choices: [
      { id: 'a', text: 'Verbal briefing to the next shift only.', isCorrect: false },
      { id: 'b', text: 'Written record of actions, justification, and any injuries.', isCorrect: true },
      { id: 'c', text: 'No report is needed if no injuries occurred.', isCorrect: false },
      { id: 'd', text: 'A photo is sufficient documentation.', isCorrect: false },
    ],
  },
  {
    id: 'com1', module: 'Communication and Dispatch', citation: 'Manual page 57',
    prompt: 'A suspect description is broadcast on radio. What must it include?',
    choices: [
      { id: 'a', text: 'Officer badge number only.', isCorrect: false },
      { id: 'b', text: 'Direction of travel, physical description, and last known location.', isCorrect: true },
      { id: 'c', text: 'Estimated time of arrival at the station.', isCorrect: false },
      { id: 'd', text: 'Shift supervisor name and position.', isCorrect: false },
    ],
  },
  {
    id: 'com2', module: 'Communication and Dispatch', citation: 'Manual page 57',
    prompt: 'A radio channel is busy during an urgent incident. What should a guard do?',
    choices: [
      { id: 'a', text: 'Wait in silence until the channel is clear.', isCorrect: false },
      { id: 'b', text: 'Interrupt with an emergency code and broadcast critical information.', isCorrect: true },
      { id: 'c', text: 'Switch to a personal cell phone.', isCorrect: false },
      { id: 'd', text: 'Abandon the broadcast and handle the situation alone.', isCorrect: false },
    ],
  },
  {
    id: 'com3', module: 'Communication and Dispatch', citation: 'Manual page 57',
    prompt: 'Dispatch issues two conflicting instructions. What is the correct action?',
    choices: [
      { id: 'a', text: 'Follow the first instruction regardless of updates.', isCorrect: false },
      { id: 'b', text: 'Follow the most recent instruction from dispatch.', isCorrect: true },
      { id: 'c', text: 'Stop all activity and wait for clarification.', isCorrect: false },
      { id: 'd', text: 'Choose whichever action seems safer without communicating.', isCorrect: false },
    ],
  },
  {
    id: 'saf1', module: 'Officer Safety', citation: 'Manual page 43',
    prompt: 'What is the safest positioning when approaching a potentially dangerous suspect?',
    choices: [
      { id: 'a', text: 'Approach directly from the front at close range.', isCorrect: false },
      { id: 'b', text: 'Maintain a safe standoff distance and angle to the side.', isCorrect: true },
      { id: 'c', text: 'Approach from directly behind to reduce visibility.', isCorrect: false },
      { id: 'd', text: 'Stand directly beside the suspect.', isCorrect: false },
    ],
  },
  {
    id: 'saf2', module: 'Officer Safety', citation: 'Manual page 43',
    prompt: 'An officer is alone and a situation escalates. What is the first correct action?',
    choices: [
      { id: 'a', text: 'Attempt solo physical control immediately.', isCorrect: false },
      { id: 'b', text: 'Withdraw completely without reporting.', isCorrect: false },
      { id: 'c', text: 'Request backup before physical engagement where possible.', isCorrect: true },
      { id: 'd', text: 'Wait for the suspect to make the first move.', isCorrect: false },
    ],
  },
  {
    id: 'saf3', module: 'Officer Safety', citation: 'Manual page 43',
    prompt: 'A suspect appears to reach for a concealed item. What is the correct immediate response?',
    choices: [
      { id: 'a', text: 'Wait and confirm what the item is before reacting.', isCorrect: false },
      { id: 'b', text: 'Increase distance, issue verbal warning, and request backup.', isCorrect: true },
      { id: 'c', text: 'Immediately tackle the suspect before they act.', isCorrect: false },
      { id: 'd', text: 'Turn away and call dispatch quietly.', isCorrect: false },
    ],
  },
  {
    id: 'pat1', module: 'Patrol and Perimeter Control', citation: 'Manual page 62',
    prompt: 'A suspect is spotted at Gate A. What is the first perimeter priority?',
    choices: [
      { id: 'a', text: 'Document the incident before taking any action.', isCorrect: false },
      { id: 'b', text: 'Pursue the suspect alone through Gate A.', isCorrect: false },
      { id: 'c', text: 'Identify and block all exit routes.', isCorrect: true },
      { id: 'd', text: 'Clear bystanders first, then assess the scene.', isCorrect: false },
    ],
  },
  {
    id: 'pat2', module: 'Patrol and Perimeter Control', citation: 'Manual page 62',
    prompt: 'Two suspects split in opposite directions. What is the correct team response?',
    choices: [
      { id: 'a', text: 'All officers pursue the same suspect for safety in numbers.', isCorrect: false },
      { id: 'b', text: 'Split to cover separate exit paths and maintain radio contact.', isCorrect: true },
      { id: 'c', text: 'Wait for both suspects to reunite before acting.', isCorrect: false },
      { id: 'd', text: 'Follow only the nearest suspect.', isCorrect: false },
    ],
  },
  {
    id: 'pat3', module: 'Patrol and Perimeter Control', citation: 'Manual page 62',
    prompt: 'A gap in an established perimeter is discovered. What must happen?',
    choices: [
      { id: 'a', text: 'Ignore it if backup is only minutes away.', isCorrect: false },
      { id: 'b', text: 'Fill the gap silently without updating team members.', isCorrect: false },
      { id: 'c', text: 'Broadcast the gap and adjust team coverage immediately.', isCorrect: true },
      { id: 'd', text: 'Retreat and reform the perimeter from scratch.', isCorrect: false },
    ],
  },
  {
    id: 'nb1', module: 'Notebook and Evidence', citation: 'Manual page 88',
    prompt: 'Which items must appear in every officer notebook entry?',
    choices: [
      { id: 'a', text: 'Badge number only.', isCorrect: false },
      { id: 'b', text: 'Date, time, location, persons involved, and actions taken.', isCorrect: true },
      { id: 'c', text: 'A summary written the next day is acceptable.', isCorrect: false },
      { id: 'd', text: 'Verbal notes recorded on a phone are sufficient.', isCorrect: false },
    ],
  },
  {
    id: 'nb2', module: 'Notebook and Evidence', citation: 'Manual page 88',
    prompt: 'Evidence is discovered at a scene. What is the correct handling procedure?',
    choices: [
      { id: 'a', text: 'Move evidence to a secure area without documentation.', isCorrect: false },
      { id: 'b', text: 'Leave all evidence in place without noting its location.', isCorrect: false },
      { id: 'c', text: 'Photograph, label, and document the chain of custody.', isCorrect: true },
      { id: 'd', text: 'Hand evidence to a supervisor and make no personal notes.', isCorrect: false },
    ],
  },
  {
    id: 'nb3', module: 'Notebook and Evidence', citation: 'Manual page 88',
    prompt: 'A witness gives a verbal statement. How should it be recorded?',
    choices: [
      { id: 'a', text: 'Trust memory and write it up in the next shift report.', isCorrect: false },
      { id: 'b', text: 'Ask the witness to write it themselves.', isCorrect: false },
      { id: 'c', text: "Note key points immediately in the officer's notebook.", isCorrect: true },
      { id: 'd', text: 'Record only the witness name and contact number.', isCorrect: false },
    ],
  },
];

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = (sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function MockExamRunner() {
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [submitted, setSubmitted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(EXAM_DURATION_SEC);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const total = EXAM_QUESTIONS.length;

  function startTimer() {
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          setSubmitted(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  useEffect(() => {
    startTimer();
    return () => clearInterval(timerRef.current!);
  }, []);

  const results = useMemo(() => {
    if (!submitted) return null;
    let correct = 0;
    const wrongByModule: Record<string, number> = {};
    const mistakeItems: MistakeItem[] = [];
    EXAM_QUESTIONS.forEach((q) => {
      const chosen = q.choices.find((c) => c.id === answers[q.id]);
      if (chosen?.isCorrect) {
        correct++;
      } else {
        wrongByModule[q.module] = (wrongByModule[q.module] ?? 0) + 1;
        mistakeItems.push({ module: q.module, issue: q.prompt, citation: q.citation, level: 'High' });
      }
    });
    const score = Math.round((correct / total) * 100);
    const weakest = Object.entries(wrongByModule).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const data = loadDashboardData();
    data.mistakes = [...mistakeItems, ...data.mistakes].slice(0, 20);
    data.stats.examScore = { value: `${score}%`, note: score >= PASS_MARK ? 'Passed' : `Need ${PASS_MARK}% to pass` };
    data.stats.mistakesToReview = { value: String(data.mistakes.length), note: 'Review recommended' };
    saveDashboardData(data);
    return { score, correct, weakest, wrongByModule };
  }, [submitted]);

  const answeredCount = Object.keys(answers).length;
  const progress = Math.round((answeredCount / total) * 100);
  const urgent = timeLeft < 300;

  function handleSubmit() {
    clearInterval(timerRef.current!);
    setSubmitted(true);
  }

  function handleRestart() {
    setAnswers({});
    setSubmitted(false);
    setTimeLeft(EXAM_DURATION_SEC);
    clearInterval(timerRef.current!);
    startTimer();
  }

  if (submitted && results) {
    const passed = results.score >= PASS_MARK;
    return (
      <Card className="roleplay-shell">
        <CardHeader>
          <Badge variant={passed ? 'success' : 'warning'}>
            {passed ? 'Passed' : 'Not yet passing'}
          </Badge>
          <CardTitle>Mock Exam Results</CardTitle>
        </CardHeader>
        <CardContent className="summary-grid">
          <div className="summary-panel">
            <p className="exam-score-big">{results.score}%</p>
            <p className="muted-text">{results.correct} of {total} correct · Pass mark: {PASS_MARK}%</p>
            {results.weakest && (
              <>
                <h4 style={{ marginTop: 16 }}>Weakest module</h4>
                <p>{results.weakest}</p>
                <p className="muted-text">{results.wrongByModule[results.weakest]} wrong — review this first</p>
              </>
            )}
          </div>
          <div className="summary-panel">
            <h4>Module breakdown</h4>
            {Object.entries(results.wrongByModule).length === 0 && (
              <p>Perfect score. No weak modules detected.</p>
            )}
            <ul>
              {Object.entries(results.wrongByModule)
                .sort((a, b) => b[1] - a[1])
                .map(([mod, count]) => (
                  <li key={mod}>{mod}: {count} wrong</li>
                ))}
            </ul>
            <p className="muted-text" style={{ marginTop: 10 }}>
              Mistakes saved to your review log in Summary.
            </p>
          </div>
        </CardContent>
        <CardFooter className="actions-row">
          <Button onClick={handleRestart}>Retry exam</Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="roleplay-shell">
      <CardHeader>
        <div className="roleplay-topline">
          <Badge variant="warning">English only · {total} questions</Badge>
          <div className={`exam-timer${urgent ? ' urgent' : ''}`} aria-live="polite" aria-label="Time remaining">
            {formatTime(timeLeft)}
          </div>
        </div>
        <CardTitle>Provincial Mock Exam</CardTitle>
        <Progress label="Questions answered" value={progress} />
      </CardHeader>
      <CardContent>
        <div className="exam-questions">
          {EXAM_QUESTIONS.map((q, idx) => (
            <div key={q.id} className="exam-q-card">
              <h4>{idx + 1}. {q.prompt}</h4>
              <div className="choices-grid" role="radiogroup" aria-label={`Question ${idx + 1}`}>
                {q.choices.map((choice) => {
                  const chosen = answers[q.id] === choice.id;
                  return (
                    <button
                      key={choice.id}
                      type="button"
                      className={`choice-btn${chosen ? ' choice-btn--correct' : ''}`}
                      onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: choice.id }))}
                    >
                      <span className="choice-id">{choice.id.toUpperCase()}</span>
                      <span>{choice.text}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
      <CardFooter className="actions-row">
        <p className="muted-text">{answeredCount} of {total} answered</p>
        <Button onClick={handleSubmit} disabled={answeredCount < total}>
          Submit exam
        </Button>
      </CardFooter>
    </Card>
  );
}

export default MockExamRunner;

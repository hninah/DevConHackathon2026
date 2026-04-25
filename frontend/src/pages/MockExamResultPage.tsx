import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import type { ExamQuestionOutcome } from '../lib/mockExamStorage';
import { loadMockExamResultById } from '../lib/mockExamStorage';
import type { Question } from '../lib/types';

export default function MockExamResultPage() {
  const { resultId = '' } = useParams();
  const result = useMemo(() => loadMockExamResultById(resultId), [resultId]);
  const [questionIndex, setQuestionIndex] = useState<Record<string, Question>>({});

  useEffect(() => {
    if (result?.questions && result.questions.length > 0) {
      const preloaded: Record<string, Question> = {};
      for (const question of result.questions) {
        preloaded[question.id] = question;
      }
      setQuestionIndex(preloaded);
      return;
    }

    let cancelled = false;
    async function loadQuestions(): Promise<void> {
      try {
        const response = await fetch('/question-bank.json');
        if (!response.ok) return;
        const questions = (await response.json()) as Question[];
        if (cancelled) return;
        const index: Record<string, Question> = {};
        for (const q of questions) {
          index[q.id] = q;
        }
        setQuestionIndex(index);
      } catch {
        setQuestionIndex({});
      }
    }
    void loadQuestions();
    return () => {
      cancelled = true;
    };
  }, [result]);

  const takenTime = useMemo(() => {
    if (!result?.secondsTaken) return 'n/a';
    const mins = Math.floor(result.secondsTaken / 60)
      .toString()
      .padStart(2, '0');
    const secs = Math.floor(result.secondsTaken % 60)
      .toString()
      .padStart(2, '0');
    return `${mins}:${secs}`;
  }, [result?.secondsTaken]);

  const outcomes = useMemo(() => {
    if (!result) {
      return [] as ExamQuestionOutcome[];
    }
    if (result.questionOutcomes && result.questionOutcomes.length > 0) {
      return result.questionOutcomes;
    }
    return Array.from({ length: result.total }, (_, index) => {
      const mistake = result.mistakes[index];
      return {
        questionId: mistake?.questionId ?? `question-${index + 1}`,
        questionNumber: index + 1,
        wasCorrect: !mistake,
      };
    });
  }, [result]);

  if (!result) {
    return (
      <div className="page-stack">
        <section className="page-intro">
          <h1>Result Not Found</h1>
          <p>This exam result link is invalid or no longer available.</p>
        </section>
        <Button asChild>
          <Link to="/exam-practice">Back to exam practice</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <section className="page-intro" id="result-heading">
        <h1>{result.examLabel} Results</h1>
        <p>
          This result is saved and can be revisited anytime from its deep link. It also updates your
          summary dashboard statistics.
        </p>
      </section>

      <Card className="exam-results">
        <CardHeader>
          <CardTitle>
            {result.passed ? 'Pass' : 'Not yet'} - {result.score}/{result.total} ({result.percentScore}
            %)
          </CardTitle>
          <CardDescription>
            Completed on {new Date(result.completedAt).toLocaleString()} • Time {takenTime}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="cta-row">
            <Button asChild>
              <Link to={`/exam-practice/mock/${result.examId}`}>Retake this mock exam</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link to="/adaptive-delivery">Open summary page</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card id="review-map">
        <CardHeader>
          <CardTitle>Question Review Map</CardTitle>
          <CardDescription>
            Green = correct, red = incorrect. Click a question box to jump to its review section.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="result-question-grid" role="list" aria-label="Question outcomes">
            {outcomes.map((outcome) => (
              <a
                key={`${outcome.questionId}-${outcome.questionNumber}`}
                href={`#review-q-${outcome.questionNumber}`}
                className={
                  outcome.wasCorrect
                    ? 'result-question-pill correct'
                    : 'result-question-pill incorrect'
                }
                role="listitem"
              >
                {outcome.questionNumber}
              </a>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Detailed Review by Question</CardTitle>
          <CardDescription>
            Every question section is separated clearly so it is easier to compare answers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="result-review-list">
            {outcomes.map((outcome) => {
              const mistake = result.mistakes.find((entry) => entry.questionId === outcome.questionId);
              const question = questionIndex[outcome.questionId];
              const selectedIndex = mistake?.selectedAnswers[0];
              const selectedText =
                selectedIndex === undefined
                  ? outcome.wasCorrect
                    ? 'Correct answer selected'
                    : 'No answer'
                  : question?.options[selectedIndex] ?? 'Unknown answer';
              const correctIndex = mistake?.correctAnswers[0] ?? question?.correctAnswers[0];
              const correctText =
                correctIndex === undefined ? 'Unknown correct answer' : question?.options[correctIndex];

              return (
                <li
                  id={`review-q-${outcome.questionNumber}`}
                  className="result-review-item"
                  key={`${outcome.questionId}-${outcome.questionNumber}`}
                >
                  <div className="result-review-header">
                    <span className="result-review-index">Question {outcome.questionNumber}</span>
                    <span
                      className={
                        outcome.wasCorrect
                          ? 'result-review-status correct'
                          : 'result-review-status incorrect'
                      }
                    >
                      {outcome.wasCorrect ? 'Correct' : 'Incorrect'}
                    </span>
                  </div>
                  <p className="mistake-question">{question?.question ?? outcome.questionId}</p>
                  <p>
                    <strong>Your answer:</strong> {selectedText}
                    <br />
                    <strong>Correct answer:</strong> {correctText ?? 'Unknown correct answer'}
                  </p>
                  {question ? (
                    <div className="explanation-block">
                      <p className="explanation-title">Explanation</p>
                      <p>
                        {outcome.wasCorrect
                          ? 'You selected the correct answer. Use the citation below to verify the source.'
                          : question.explanation}
                      </p>
                      <details className="citation-block">
                        <summary>See citation (page {question.citation.page_number})</summary>
                        <pre>{question.citation.chunk_text}</pre>
                      </details>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </CardContent>
      </Card>

      <div className="jump-controls" aria-label="Quick jump controls">
        <a className="jump-control-button" href="#result-heading" aria-label="Jump to top heading">
          ↑
        </a>
        <a className="jump-control-button" href="#review-map" aria-label="Jump to review map">
          ↓
        </a>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CirclePlus } from 'lucide-react';

import { createBackendMockExam } from '../api/mockExamClient';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  loadMockExamResults,
  loadMockExams,
  upsertMockExam,
  type MockExamDefinition,
  type StoredMockExamResult,
} from '../lib/mockExamStorage';

export default function ExamPracticePage() {
  const navigate = useNavigate();
  const [mockExams, setMockExams] = useState<MockExamDefinition[]>([]);
  const [results, setResults] = useState<StoredMockExamResult[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [pendingStartExam, setPendingStartExam] = useState<MockExamDefinition | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    setMockExams(loadMockExams());
    setResults(loadMockExamResults());
  }, []);

  const latestByExamId = useMemo(() => {
    const map: Record<string, StoredMockExamResult> = {};
    for (const result of results) {
      if (!map[result.examId]) {
        map[result.examId] = result;
      }
    }
    return map;
  }, [results]);

  async function handleCreateMockExam(): Promise<void> {
    setCreateError(null);
    setIsCreating(true);
    try {
      const generated = await createBackendMockExam();
      upsertMockExam({
        id: generated.id,
        label: generated.label,
        questionCount: generated.questionCount,
        durationSeconds: generated.durationSeconds,
        createdAt: generated.createdAt,
        source: generated.source ?? 'backend',
        questions: generated.questions,
      });
      setMockExams(loadMockExams());
      setIsCreateOpen(false);
    } catch (error) {
      setCreateError(
        error instanceof Error
          ? `${error.message} Please make sure backend is running and configure VITE_API_BASE_URL or VITE_MOCK_EXAM_API_URL.`
          : 'Backend creation failed. Please make sure backend is running and env vars are configured.',
      );
    } finally {
      setIsCreating(false);
    }
  }

  function handleStartExam(exam: MockExamDefinition): void {
    setPendingStartExam(exam);
  }

  function confirmStartExam(): void {
    if (!pendingStartExam) {
      return;
    }
    navigate(`/exam-practice/mock/${pendingStartExam.id}`);
    setPendingStartExam(null);
  }

  return (
    <div className="page-stack">
      <section className="page-intro">
        <h1>Mock Exam Practice</h1>
        <p>
          Practice key concepts first, then complete mock exams in English to match the provincial
          format and pass threshold. Submissions open a dedicated result page and remain saved for
          your summary dashboard.
        </p>
      </section>

      <section className="mock-exam-library" aria-label="Mock exam cards">
        {mockExams.map((exam) => {
          const latest = latestByExamId[exam.id];
          return (
            <Card key={exam.id} className="mock-exam-card">
              <CardHeader>
                <CardTitle>{exam.label}</CardTitle>
                <CardDescription>
                  {exam.questionCount} questions • {Math.round(exam.durationSeconds / 60)} minutes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="mock-exam-note">
                  {latest
                    ? `Latest score: ${latest.score}/${latest.total} (${latest.percentScore}%)`
                    : 'No submission yet.'}
                </p>
                <div className="cta-row">
                  <Button onClick={() => handleStartExam(exam)} type="button">
                    Start {exam.label}
                  </Button>
                  {latest ? (
                    <Button asChild variant="secondary">
                      <Link to={`/exam-practice/results/${latest.id}`}>View latest result</Link>
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          );
        })}

        <button className="mock-exam-add-card" onClick={() => setIsCreateOpen(true)} type="button">
          <CirclePlus size={22} aria-hidden="true" />
          <span>Add Mock Exam</span>
        </button>
      </section>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent aria-describedby="create-mock-exam-description">
          <DialogHeader>
            <DialogTitle>Create more mock exam questions?</DialogTitle>
            <DialogDescription id="create-mock-exam-description">
              Do you want to create more mock exam question sets? A new empty mock exam card will be
              added with the same layout and settings.
            </DialogDescription>
          </DialogHeader>
          <div className="dialog-actions">
            <Button variant="secondary" onClick={() => setIsCreateOpen(false)} type="button">
              Cancel
            </Button>
            <Button onClick={() => void handleCreateMockExam()} type="button" disabled={isCreating}>
              {isCreating ? 'Creating…' : 'Create mock exam card'}
            </Button>
          </div>
          {createError ? <p className="error">{createError}</p> : null}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(pendingStartExam)} onOpenChange={(open) => !open && setPendingStartExam(null)}>
        <DialogContent aria-describedby="start-mock-exam-description">
          <DialogHeader>
            <DialogTitle>Start {pendingStartExam?.label ?? 'mock exam'} now?</DialogTitle>
            <DialogDescription id="start-mock-exam-description">
              You will enter the test immediately. Submit when done to save results and update the
              summary page.
            </DialogDescription>
          </DialogHeader>
          <div className="dialog-actions">
            <Button variant="secondary" onClick={() => setPendingStartExam(null)} type="button">
              Cancel
            </Button>
            <Button onClick={confirmStartExam} type="button">
              Start exam
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

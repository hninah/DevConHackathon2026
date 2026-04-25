import { Link, useNavigate, useParams } from 'react-router-dom';

import MockExamRunner from '../components/tier1/MockExamRunner';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { loadMockExamById } from '../lib/mockExamStorage';

export default function MockExamSessionPage() {
  const navigate = useNavigate();
  const { examId = '' } = useParams();
  const exam = loadMockExamById(examId);

  if (!exam) {
    return (
      <div className="page-stack">
        <section className="page-intro">
          <h1>Mock Exam Not Found</h1>
          <p>This mock exam was not found. Return to Exam Practice and start a new one.</p>
        </section>
        <Card>
          <CardHeader>
            <CardTitle>Return to Exam Practice</CardTitle>
            <CardDescription>Create or choose another mock exam card.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to="/exam-practice">Go to exam practice</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <MockExamRunner
        examId={exam.id}
        examLabel={exam.label}
        totalQuestions={exam.questionCount}
        durationSeconds={exam.durationSeconds}
        presetQuestions={exam.questions}
        autoStartOnEntry
        onSubmitted={(resultId) => navigate(`/exam-practice/results/${resultId}`)}
      />
    </div>
  );
}

import { Link } from 'react-router-dom';
import { ClipboardCheck, FileSearch, Gauge } from 'lucide-react';

import FeatureGrid from '../components/FeatureGrid';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { examPracticeHighlights } from '../lib/siteContent';

export default function ExamPracticePage() {
  return (
    <div className="page-stack">
      <section className="page-intro">
        <h1>Exam Format Practice</h1>
        <p>
          Practice in student language first, then complete mock exams in English to match the
          provincial format and pass threshold.
        </p>
      </section>

      <FeatureGrid
        title="Exam Practice Flow"
        subtitle="Scaffold understanding, then test in English under realistic constraints."
        items={examPracticeHighlights}
      />

      <section className="feature-grid split">
        <Card>
          <CardHeader>
            <div className="icon-wrap" aria-hidden="true">
              <Gauge size={18} />
            </div>
            <CardTitle>Performance Rule</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Students must reach at least 80% before the workflow marks them ready to sit the
              official test.
            </CardDescription>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="icon-wrap" aria-hidden="true">
              <ClipboardCheck size={18} />
            </div>
            <CardTitle>Mistake Log Review</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Every mistake includes simplified feedback and citation so learners can verify the
              rule quickly.
            </CardDescription>
            <Button asChild variant="secondary" size="sm">
              <Link to="/exam-practice?modal=mistake-log">View mistake log modal</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="icon-wrap" aria-hidden="true">
              <FileSearch size={18} />
            </div>
            <CardTitle>English-Only Mock</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Final mock remains English-only to mirror real assessment and reduce test-day
              surprises.
            </CardDescription>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

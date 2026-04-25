import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowUpRight, BookOpenCheck, FileText, ShieldAlert, Wrench } from 'lucide-react';

import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { DEFAULT_DASHBOARD, loadDashboardData } from '../lib/dashboardStorage';
import { getLatestMockExamResult } from '../lib/mockExamStorage';

export default function AdaptiveDeliveryPage() {
  const [dashboard, setDashboard] = useState(DEFAULT_DASHBOARD);
  const [latestResultLabel, setLatestResultLabel] = useState('No mock exam submitted yet');

  useEffect(() => {
    setDashboard(loadDashboardData());
    const latest = getLatestMockExamResult();
    if (latest) {
      setLatestResultLabel(
        `${latest.examLabel}: ${latest.score}/${latest.total} (${latest.percentScore}%)`,
      );
    }
  }, []);

  const highPriorityCount = useMemo(
    () => dashboard.mistakes.filter((mistake) => mistake.level === 'High').length,
    [dashboard.mistakes],
  );

  return (
    <div className="page-stack">
      <section className="dashboard-welcome">
        <h1>Summary Dashboard</h1>
        <p>
          Review mistakes, see weak modules, and follow a clear plan to reach exam readiness.
        </p>
      </section>

      <section className="stats-grid">
        <Card>
          <CardHeader>
            <CardTitle>Total Logged Mistakes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="stat-value">{dashboard.stats.mistakesToReview.value}</p>
            <CardDescription>Last 7 days</CardDescription>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>High Priority</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="stat-value">{highPriorityCount}</p>
            <CardDescription className="trend warning">
              <ShieldAlert size={14} aria-hidden="true" /> Review today
            </CardDescription>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Most Affected Module</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="stat-value">Module 3</p>
            <CardDescription>Emergency Response</CardDescription>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Improvement Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="stat-value">+12%</p>
            <CardDescription className="trend">
              <ArrowUpRight size={14} aria-hidden="true" /> Accuracy after review
            </CardDescription>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Latest Mock Exam</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="stat-value" style={{ fontSize: '1.25rem' }}>
              {latestResultLabel}
            </p>
            <CardDescription>Synced from saved exam results</CardDescription>
          </CardContent>
        </Card>
      </section>

      <section className="dashboard-grid">
        <Card>
          <CardHeader>
            <CardTitle>Mistake Log</CardTitle>
            <CardDescription>Citation-linked feedback</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="mistake-list">
              {dashboard.mistakes.map((item) => (
                <li key={`${item.module}-${item.issue}`}>
                  <div className="mistake-head">
                    <strong>{item.module}</strong>
                    <span className={`status ${item.level === 'High' ? 'active' : 'locked'}`}>
                      {item.level}
                    </span>
                  </div>
                  <p>{item.issue}</p>
                  <p className="mistake-citation">
                    <FileText size={14} aria-hidden="true" />
                    {item.citation}
                  </p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Modules to Improve</CardTitle>
            <CardDescription>Ordered by impact on exam readiness</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="todo-list">
              <li>
                <AlertCircle size={16} aria-hidden="true" />
                <div>
                  <strong>Module 3: Emergency Response</strong>
                  <p>Practice action sequence and incident first-response terms.</p>
                </div>
              </li>
              <li>
                <Wrench size={16} aria-hidden="true" />
                <div>
                  <strong>Module 5: Report Writing</strong>
                  <p>Review report format checklist and required factual details.</p>
                </div>
              </li>
              <li>
                <BookOpenCheck size={16} aria-hidden="true" />
                <div>
                  <strong>Module 2: Legal Authorities</strong>
                  <p>Revisit legal limits with simplified examples and citation checks.</p>
                </div>
              </li>
            </ul>
            <Button type="button">Start Priority Review</Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

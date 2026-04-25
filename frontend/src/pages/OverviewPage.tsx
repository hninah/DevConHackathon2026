import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  CircleCheckBig,
  ClipboardPenLine,
  Drama,
  TrendingUp,
  TriangleAlert,
} from 'lucide-react';

import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { DEFAULT_DASHBOARD, loadDashboardData, saveDashboardData } from '../lib/dashboardStorage';

export default function OverviewPage() {
  const [dashboard, setDashboard] = useState(DEFAULT_DASHBOARD);
  const [pendingName, setPendingName] = useState('');

  useEffect(() => {
    const stored = loadDashboardData();
    setDashboard(stored);
    setPendingName(stored.learnerName);
  }, []);

  function handleNameSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const trimmed = pendingName.trim();
    if (!trimmed) return;

    const next = { ...dashboard, learnerName: trimmed };
    setDashboard(next);
    saveDashboardData(next);
  }

  return (
    <div className="page-stack">
      <Dialog open={!dashboard.learnerName}>
        <DialogContent
          aria-describedby="onboarding-name-description"
          onEscapeKeyDown={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Get started</DialogTitle>
            <DialogDescription id="onboarding-name-description">
              Enter your name to create your local dashboard.
            </DialogDescription>
          </DialogHeader>
          <form className="name-form" onSubmit={handleNameSubmit}>
            <label htmlFor="learner-name">Your name</label>
            <input
              id="learner-name"
              type="text"
              value={pendingName}
              onChange={(event) => setPendingName(event.target.value)}
              placeholder="Enter your name"
              autoComplete="name"
              required
            />
            <Button type="submit">Save and continue</Button>
          </form>
        </DialogContent>
      </Dialog>

      <section className="dashboard-welcome">
        <h1>Welcome back, {dashboard.learnerName || 'Learner'}</h1>
        <p>
          You are {dashboard.moduleProgress}% through Module 4. Keep going. You need{' '}
          {dashboard.passTarget}% to pass the provincial exam.
        </p>
        <div className="cta-row">
          <Button asChild>
            <Link to="/text-tutor">
              <BookOpen size={16} aria-hidden="true" />
              Continue Studying
            </Link>
          </Button>
          <Button asChild variant="secondary">
            <Link to="/exam-practice">
              <ClipboardPenLine size={16} aria-hidden="true" />
              Take Practice Exam
            </Link>
          </Button>
          <Button asChild variant="secondary">
            <Link to="/roleplay">
              <Drama size={16} aria-hidden="true" />
              Roleplay Scenario
            </Link>
          </Button>
        </div>
      </section>

      <section className="stats-grid" aria-label="Overall learning statistics">
        <Card>
          <CardHeader>
            <CardTitle>Overall Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="stat-value">{dashboard.stats.overallProgress.value}</p>
            <CardDescription className="trend">
              <TrendingUp size={14} aria-hidden="true" /> {dashboard.stats.overallProgress.note}
            </CardDescription>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Exam Score</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="stat-value">{dashboard.stats.examScore.value}</p>
            <CardDescription>{dashboard.stats.examScore.note}</CardDescription>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Questions Answered</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="stat-value">{dashboard.stats.questionsAnswered.value}</p>
            <CardDescription className="trend">
              <TrendingUp size={14} aria-hidden="true" /> {dashboard.stats.questionsAnswered.note}
            </CardDescription>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Mistakes to Review</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="stat-value">{dashboard.stats.mistakesToReview.value}</p>
            <CardDescription className="trend warning">
              <TriangleAlert size={14} aria-hidden="true" /> {dashboard.stats.mistakesToReview.note}
            </CardDescription>
          </CardContent>
        </Card>
      </section>

      <section className="dashboard-grid">
        <Card>
          <CardHeader>
            <CardTitle>Course Modules</CardTitle>
            <CardDescription>8 modules</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="module-list">
              {dashboard.modules.map((module) => (
                <li key={module.id}>
                  <div>
                    <strong>
                      {module.id}. {module.title}
                    </strong>
                    <p>{module.detail}</p>
                  </div>
                  <span className={`status ${module.status}`}>
                    {module.status === 'done'
                      ? 'Done'
                      : module.status === 'active'
                        ? 'Active'
                        : 'Locked'}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Today&apos;s To-Do</CardTitle>
            <CardDescription>Based on your weak areas</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="todo-list">
              {dashboard.todos.map((todo) => (
                <li key={todo.title}>
                  <CircleCheckBig size={16} aria-hidden="true" />
                  <div>
                    <strong>{todo.title}</strong>
                    <p>{todo.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
            <Button asChild variant="ghost" className="view-log-link">
              <Link to="/adaptive-delivery">View Full Mistake Log</Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

export type DashboardStat = {
  value: string;
  note: string;
};

export type CourseModule = {
  id: number;
  title: string;
  detail: string;
  status: 'done' | 'active' | 'locked';
};

export type TodoItem = {
  title: string;
  detail: string;
};

export type MistakeItem = {
  module: string;
  issue: string;
  citation: string;
  level: 'High' | 'Medium' | 'Low';
};

export type DashboardData = {
  learnerName: string;
  moduleProgress: number;
  passTarget: number;
  stats: {
    overallProgress: DashboardStat;
    examScore: DashboardStat;
    questionsAnswered: DashboardStat;
    mistakesToReview: DashboardStat;
  };
  modules: CourseModule[];
  todos: TodoItem[];
  mistakes: MistakeItem[];
};

const DASHBOARD_KEY = 'securepass:dashboard';

export const DEFAULT_DASHBOARD: DashboardData = {
  learnerName: '',
  moduleProgress: 68,
  passTarget: 80,
  stats: {
    overallProgress: { value: '68%', note: '+5% this week' },
    examScore: { value: '74%', note: 'Need 80% to pass' },
    questionsAnswered: { value: '142', note: '18 today' },
    mistakesToReview: { value: '9', note: 'Review recommended' },
  },
  modules: [
    { id: 1, title: 'Introduction to Security', detail: 'Completed · 12 pages', status: 'done' },
    {
      id: 2,
      title: 'Legal Authorities',
      detail: 'Completed · 18 pages · Simplified English',
      status: 'done',
    },
    {
      id: 3,
      title: 'Emergency Response',
      detail: 'In progress · 68% · 22 pages',
      status: 'active',
    },
    { id: 4, title: 'Patrol Procedures', detail: 'Not started · 16 pages', status: 'locked' },
    { id: 5, title: 'Report Writing', detail: 'Not started · 14 pages', status: 'locked' },
  ],
  todos: [
    { title: 'Review Legal Authority terms', detail: 'Module 2 · 15 min' },
    { title: 'Practice Emergency Response Q and A', detail: 'Module 3 · 20 min · Weak area' },
    { title: 'Complete scenario: Reporting Theft', detail: 'Module 5 · 25 min' },
    { title: 'Review 9 mistake log items', detail: 'Multiple modules · 15 min' },
  ],
  mistakes: [
    {
      module: 'Module 2 · Legal Authorities',
      issue: 'Confused detention authority with arrest authority',
      citation: 'Manual page 38',
      level: 'High',
    },
    {
      module: 'Module 3 · Emergency Response',
      issue: 'Wrong sequence for first response at incident scene',
      citation: 'Manual page 74',
      level: 'High',
    },
    {
      module: 'Module 5 · Report Writing',
      issue: 'Missing required details in incident report',
      citation: 'Manual page 112',
      level: 'Medium',
    },
    {
      module: 'Module 3 · Emergency Response',
      issue: 'Incorrect wording for witness statement notes',
      citation: 'Manual page 81',
      level: 'Medium',
    },
  ],
};

export function loadDashboardData(): DashboardData {
  const raw = window.localStorage.getItem(DASHBOARD_KEY);
  if (!raw) {
    saveDashboardData(DEFAULT_DASHBOARD);
    return DEFAULT_DASHBOARD;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<DashboardData>;
    return {
      ...DEFAULT_DASHBOARD,
      ...parsed,
      stats: {
        ...DEFAULT_DASHBOARD.stats,
        ...parsed.stats,
      },
      modules: parsed.modules ?? DEFAULT_DASHBOARD.modules,
      todos: parsed.todos ?? DEFAULT_DASHBOARD.todos,
      mistakes: parsed.mistakes ?? DEFAULT_DASHBOARD.mistakes,
    };
  } catch {
    return DEFAULT_DASHBOARD;
  }
}

export function saveDashboardData(data: DashboardData): void {
  window.localStorage.setItem(DASHBOARD_KEY, JSON.stringify(data));
}

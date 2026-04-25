import {
  BookCheck,
  BrainCircuit,
  Compass,
  ListChecks,
  MapPinned,
  MessageSquareText,
  ShieldQuestion,
  Target,
} from 'lucide-react';

export type ModalSpec = {
  id: string;
  title: string;
  details: string;
  checklist: string[];
};

export const challengeSummary = {
  title: 'Alberta Basic Security Guard Training Support',
  body: 'Students with minimum CLB 5 English need simplified and guided practice to pass a provincial exam that is delivered in English only.',
};

export const navLinks = [
  { to: '/', label: 'Overview' },
  { to: '/text-tutor', label: 'Text Tutor' },
  { to: '/exam-practice', label: 'Exam Practice' },
  { to: '/roleplay', label: 'Roleplay' },
  { to: '/adaptive-delivery', label: 'Summary' },
];

export const textTutorHighlights = [
  {
    icon: MessageSquareText,
    title: 'Ask exam questions',
    description:
      'The learner receives simplified English plus source citations from the Alberta manual.',
  },
  {
    icon: BookCheck,
    title: 'Citations with priority',
    description:
      'Responses prioritize safety-critical chunks and always show manual references for trust.',
  },
  {
    icon: MapPinned,
    title: 'House lookup flow',
    description:
      'Location guidance uses map context without requiring an exposed public search bar.',
  },
];

export const examPracticeHighlights = [
  {
    icon: ShieldQuestion,
    title: 'English-style mock exams',
    description:
      'The exam mirrors provincial structure in English and tracks if the learner reaches 80%.',
  },
  {
    icon: ListChecks,
    title: 'Mistake log with citations',
    description:
      'Incorrect answers are saved with citations and simplified explanations for review loops.',
  },
  {
    icon: Target,
    title: 'Module-focused remediation',
    description:
      'Each attempt ends with a module summary and ordered to-do list for what to study first.',
  },
];

export const roleplayHighlights = [
  {
    icon: Compass,
    title: 'Passive mode',
    description:
      'Learner plays thief while AI plays police to teach reporting and response boundaries.',
  },
  {
    icon: BrainCircuit,
    title: 'Active mode',
    description:
      'Learner plays police and answers multi-part sequencing questions for tactical thinking.',
  },
  {
    icon: BookCheck,
    title: 'Visual scenario generation',
    description:
      'AI-generated scene images make legal terms concrete with immediate simplified feedback.',
  },
];

export const modalSpecs: ModalSpec[] = [
  {
    id: 'design-rules',
    title: 'Design Heuristics Applied',
    details:
      'The mock interface follows Nielsen heuristics and CRAP principles through consistent navigation, high-contrast visuals, clear hierarchy, and low cognitive load.',
    checklist: [
      'Visibility of system status with progress and context banners',
      'Recognition over recall through fixed navigation and reusable card patterns',
      'Consistency and standards through shared component primitives',
      'Contrast, repetition, alignment, and proximity in every page layout',
    ],
  },
  {
    id: 'mistake-log',
    title: 'Mistake Log Experience',
    details:
      'The mistake log stores missed questions, source pages, and simplified explanations to prioritize high-impact review actions.',
    checklist: [
      'Sort by module and risk level',
      'Show direct citation page for each mistake',
      'Provide one-click review task creation',
      'Track repeated misunderstandings across attempts',
    ],
  },
  {
    id: 'roleplay-summary',
    title: 'Roleplay Summary Page',
    details:
      'After each scenario run, learners receive a focused module summary plus a to-do list in plain English.',
    checklist: [
      'Highlight best and weakest modules',
      'Recommend next 3 review actions',
      'Link each action to source citation',
      'Use simplified terms for legal language',
    ],
  },
];

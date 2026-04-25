export type LearningStyle = 'text' | 'audio' | 'visual';

export type Citation = {
  page_number: number;
  chunk_text: string;
};

export type TutorResponse = {
  answer: string;
  citations: Citation[];
  priority_rationale: string;
};

export type Profile = {
  language: string;
  learning_style: LearningStyle;
};

export type LanguageOption = {
  name: string;
  nativeName: string;
};

export type Mode = 'ask' | 'practice' | 'listen';

export type QuestionType = 'mcq' | 'select-all';

export type Question = {
  id: string;
  module: string;
  type: QuestionType;
  question: string;
  simplified?: string;
  options: string[];
  correctAnswers: number[];
  explanation: string;
  wrongAnswerExplanations?: Array<string | null>;
  citation: Citation;
  image?: string | null;
};

export type MistakeEntry = {
  questionId: string;
  module: string;
  selectedAnswers: number[];
  correctAnswers: number[];
  timestamp: number;
};

export type ExamResult = {
  score: number;
  total: number;
  passed: boolean;
  mistakes: MistakeEntry[];
  completedAt: number;
  secondsTaken?: number;
};

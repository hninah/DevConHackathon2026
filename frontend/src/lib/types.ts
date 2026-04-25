export type LearningStyle = 'text' | 'audio' | 'visual';

export type Citation = {
  page_number: number;
  chunk_text: string;
  chunk_id?: number;
  score?: number;
};

export type GlossaryTerm = {
  term: string;
  plain_english_definition: string;
  page_number: number | null;
};

export type ExamPriority = 'HIGH' | 'MEDIUM' | 'BACKGROUND';

export type TutorResponse = {
  answer: string;
  citations: Citation[];
  priority: ExamPriority;
  priority_rationale: string;
  svg: string | null;
  scene_png_b64: string | null;
  scene_image_prompt: string | null;
  scene_image_error: string | null;
  glossary_terms: GlossaryTerm[];
};

export type Profile = {
  learning_style: LearningStyle;
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

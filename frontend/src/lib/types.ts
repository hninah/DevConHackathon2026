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

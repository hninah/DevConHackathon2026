import type { TutorResponse } from '../lib/types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

const MOCK_RESPONSE: TutorResponse = {
  answer:
    'You may only use reasonable force when authorized by law, such as self-defence, helping police, or stopping a criminal act. Exam priority: HIGH',
  citations: [
    {
      page_number: 43,
      chunk_text:
        'In simpler terms, you may use reasonable force when aiding a police or peace officer, protecting yourself or others from harm, or stopping an individual from committing a criminal act.',
    },
  ],
  priority_rationale:
    'Use of force is a high-priority exam topic because it connects legal authority, restraint, and excessive force liability.',
};

export async function askTutor(
  question: string,
  language: string,
  image_b64?: string,
): Promise<TutorResponse> {
  if (!API_BASE_URL) {
    await new Promise((resolve) => window.setTimeout(resolve, 300));
    return MOCK_RESPONSE;
  }

  const response = await fetch(`${API_BASE_URL}/tutor`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      question,
      language,
      image_b64,
    }),
  });

  if (!response.ok) {
    throw new Error(`Tutor request failed: ${response.status}`);
  }

  return response.json() as Promise<TutorResponse>;
}

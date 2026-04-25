import type { TutorResponse } from '../lib/types';
import type { ScenarioScript } from '../lib/roleplayScenario';

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

export type RoleplayAnswerRequest = {
  mode: 'passive' | 'active';
  selected_scenario_id: string;
  current_part_id: string;
  choice_id: string;
};

export type RoleplayAnswerResponse = {
  is_correct: boolean;
  simplified_explanation: string;
  module: string;
  current_part_id: string;
  next_part_id: string | null;
  next_scenario_id: string | null;
  completed: boolean;
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

export async function submitRoleplayAnswer(
  payload: RoleplayAnswerRequest,
): Promise<RoleplayAnswerResponse> {
  if (!API_BASE_URL) {
    await new Promise((resolve) => window.setTimeout(resolve, 150));
    return {
      is_correct: true,
      simplified_explanation: '',
      module: '',
      current_part_id: payload.current_part_id,
      next_part_id: null,
      next_scenario_id: null,
      completed: false,
    };
  }

  const response = await fetch(`${API_BASE_URL}/roleplay/answer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Roleplay answer request failed: ${response.status}`);
  }

  return response.json() as Promise<RoleplayAnswerResponse>;
}

export async function fetchNextRoleplayScenario(
  mode: 'passive' | 'active',
  excludeScenarioIds: string[],
): Promise<ScenarioScript> {
  if (!API_BASE_URL) {
    throw new Error('Backend URL not configured for manual scenario generation.');
  }

  const response = await fetch(`${API_BASE_URL}/roleplay/next-scenario`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      mode,
      exclude_scenario_ids: excludeScenarioIds,
    }),
  });

  if (!response.ok) {
    throw new Error(`Roleplay scenario request failed: ${response.status}`);
  }

  return response.json() as Promise<ScenarioScript>;
}

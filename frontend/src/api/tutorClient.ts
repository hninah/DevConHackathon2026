import type { TutorResponse } from '../lib/types';
import type { ScenarioScript } from '../lib/roleplayScenario';

const USE_MOCK = import.meta.env.VITE_USE_MOCK === '1';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.toString().trim().replace(/\/$/, '') ?? '';

/** Resolve the HTTP endpoint for POST /tutor (API Gateway) or a Lambda Function URL (full URL, no path). */
export function getTutorPostUrl(): string {
  const explicit = import.meta.env.VITE_TUTOR_API_URL?.toString().trim();
  if (explicit) return explicit;
  const base = import.meta.env.VITE_API_BASE_URL?.toString().trim();
  if (!base) return '';
  return `${base.replace(/\/$/, '')}/tutor`;
}

export const TUTOR_API_CONFIGURED = USE_MOCK || Boolean(getTutorPostUrl().length);

/** True when a real HTTP tutor endpoint is set (not mock). */
export function isTutorLiveConfigured(): boolean {
  return !USE_MOCK && Boolean(getTutorPostUrl().length);
}

const MOCK_RESPONSE: TutorResponse = {
  answer:
    'You may only use reasonable force when authorized by law, such as self-defence, helping police, or stopping a criminal act.',
  citations: [
    {
      page_number: 43,
      chunk_text:
        'In simpler terms, you may use reasonable force when aiding a police or peace officer, protecting yourself or others from harm, or stopping an individual from committing a criminal act.',
    },
  ],
  priority: 'HIGH',
  priority_rationale:
    'Use of force is a high-priority exam topic because it connects legal authority, restraint, and excessive force liability.',
  svg: null,
  scene_png_b64: null,
  scene_image_prompt: null,
  scene_image_error: null,
  glossary_terms: [
    {
      term: 'reasonable force',
      plain_english_definition: 'Just enough force to stop the problem, and no more.',
      page_number: 44,
    },
  ],
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

export type AskTutorOptions = {
  image_b64?: string;
  include_diagram?: 'auto' | 'always' | 'never';
  include_scene_image?: 'auto' | 'always' | 'never';
  top_k?: number;
};

/**
 * Call the RAG tutor (`lambda_tutor.handler`).
 * - With `VITE_USE_MOCK=1`, returns mock data (no network).
 * - Otherwise requires `VITE_TUTOR_API_URL` or `VITE_API_BASE_URL` (see `getTutorPostUrl`).
 */
export async function askTutor(
  question: string,
  options: AskTutorOptions = {},
): Promise<TutorResponse> {
  if (USE_MOCK) {
    await new Promise((resolve) => window.setTimeout(resolve, 300));
    return MOCK_RESPONSE;
  }

  const url = getTutorPostUrl();
  if (!url) {
    throw new Error(
      'Tutor API is not configured. Set VITE_TUTOR_API_URL (Function URL) or VITE_API_BASE_URL (adds /tutor) in frontend/.env.local, or set VITE_USE_MOCK=1 for local mock data.',
    );
  }

  const {
    image_b64,
    include_diagram = 'auto',
    include_scene_image = 'auto',
    top_k,
  } = options;

  const body: Record<string, unknown> = {
    question,
    include_diagram,
    include_scene_image,
  };
  if (image_b64) body.image_b64 = image_b64;
  if (top_k !== undefined) body.top_k = top_k;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    let message = `Tutor request failed: ${response.status}`;
    try {
      const j = JSON.parse(errText) as { error?: string };
      if (j.error) message = `${message}: ${j.error}`;
    } catch {
      if (errText) message = `${message} ${errText.slice(0, 200)}`;
    }
    throw new Error(message);
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

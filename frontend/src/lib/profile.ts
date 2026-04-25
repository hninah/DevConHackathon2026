import type { Profile } from './types';

const PROFILE_KEY = 'securepass:profile';

export const DEFAULT_PROFILE: Profile = {
  language: 'Punjabi',
  learning_style: 'text',
};

export function loadProfile(): Profile {
  const raw = window.localStorage.getItem(PROFILE_KEY);
  if (!raw) {
    return DEFAULT_PROFILE;
  }

  try {
    return {
      ...DEFAULT_PROFILE,
      ...JSON.parse(raw),
    };
  } catch {
    return DEFAULT_PROFILE;
  }
}

export function saveProfile(profile: Profile): void {
  window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

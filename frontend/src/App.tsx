import { useEffect, useState } from 'react';

import AskMode from './components/AskMode';
import LanguagePicker from './components/LanguagePicker';
import ListenMode from './components/ListenMode';
import ModeSwitcher from './components/ModeSwitcher';
import PracticeMode from './components/PracticeMode';
import { DEFAULT_PROFILE, loadProfile, saveProfile } from './lib/profile';
import type { LearningStyle, Mode, Profile } from './lib/types';

function App() {
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [mode, setMode] = useState<Mode>('ask');

  useEffect(() => {
    setProfile(loadProfile());
  }, []);

  function updateProfile(next: Profile): void {
    setProfile(next);
    saveProfile(next);
  }

  function updateLearningStyle(learning_style: LearningStyle): void {
    updateProfile({
      ...profile,
      learning_style,
    });
  }

  return (
    <main className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">SecurePass</p>
          <h1>Exam coaching for Alberta security guard students</h1>
          <p className="hero-copy">
            Ask questions, practice exam scenarios, and listen in the language a
            student actually studies in. Punjabi is the demo path, but the shell
            proves 100+ language support.
          </p>
        </div>

        <section className="profile-card" aria-label="Student profile">
          <LanguagePicker
            value={profile.language}
            onChange={(language) => updateProfile({ ...profile, language })}
          />
          <label className="field">
            Learning style
            <select
              value={profile.learning_style}
              onChange={(event) =>
                updateLearningStyle(event.target.value as LearningStyle)
              }
            >
              <option value="text">Text</option>
              <option value="audio">Audio</option>
              <option value="visual">Visual</option>
            </select>
          </label>
        </section>
      </header>

      <ModeSwitcher activeMode={mode} onChange={setMode} />

      {mode === 'ask' && <AskMode profile={profile} />}
      {mode === 'practice' && <PracticeMode />}
      {mode === 'listen' && <ListenMode />}
    </main>
  );
}

export default App;

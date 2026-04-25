import { useState } from 'react';

import { askTutor } from '../api/tutorClient';
import type { Profile, TutorResponse } from '../lib/types';
import CameraCapture from './tier1/CameraCapture';
import CitationPopover from './tier1/CitationPopover';
import PriorityTooltip from './tier1/PriorityTooltip';

type AskModeProps = {
  profile: Profile;
};

function AskMode({ profile }: AskModeProps) {
  const [question, setQuestion] = useState(
    'When am I allowed to physically restrain someone?',
  );
  const [response, setResponse] = useState<TutorResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(): Promise<void> {
    setIsLoading(true);
    setError(null);
    try {
      setResponse(await askTutor(question, profile.language));
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Tutor request failed.',
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="mode-panel">
      <div className="primary-card">
        <p className="eyebrow">Ask mode</p>
        <h2>Test-aware tutor</h2>
        <textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          rows={4}
        />
        <button disabled={isLoading} onClick={handleSubmit} type="button">
          {isLoading ? 'Asking...' : `Ask in ${profile.language}`}
        </button>
        {error && <p className="error">{error}</p>}
        {response && (
          <article className="answer-card">
            <h3>Mock tutor response</h3>
            <p>{response.answer}</p>
          </article>
        )}
      </div>

      <div className="feature-grid">
        <CameraCapture />
        <CitationPopover citation={response?.citations[0]} />
        <PriorityTooltip rationale={response?.priority_rationale} />
      </div>
    </section>
  );
}

export default AskMode;

import { useState } from 'react';

import { askTutor } from '../api/tutorClient';
import type { TutorResponse } from '../lib/types';
import LanguagePicker from './LanguagePicker';
import CameraCapture from './tier1/CameraCapture';
import CitationPopover from './tier1/CitationPopover';
import PriorityTooltip from './tier1/PriorityTooltip';

function AskMode() {
  const [question, setQuestion] = useState(
    'When am I allowed to physically restrain someone?',
  );
  const [language, setLanguage] = useState('Punjabi');
  const [response, setResponse] = useState<TutorResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageB64, setImageB64] = useState<string | undefined>(undefined);

  async function handleSubmit(): Promise<void> {
    setIsLoading(true);
    setError(null);
    try {
      setResponse(await askTutor(question, language, imageB64));
      setImageB64(undefined);
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
        <h2>Text tutor, RAG, vectorized chunks, map context</h2>
        <p className="mode-note">
          Ask in your language. Tutor returns cited answer and priority, then
          breaks legal terms into plain English.
        </p>
        <LanguagePicker value={language} onChange={setLanguage} />
        <div className="chip-row">
          <span className="priority-chip">Cited pages with exam priority</span>
          <span className="priority-chip">Simplified English legal breakdown</span>
        </div>
        <textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          rows={4}
        />
        <button disabled={isLoading} onClick={handleSubmit} type="button">
          {isLoading
            ? 'Asking...'
            : `Ask in ${language}, explain in simple English`}
        </button>
        {error && <p className="error">{error}</p>}
        {response && (
          <article className="answer-card">
            <h3>Tutor output</h3>
            <p>{response.answer}</p>
            <p className="field-hint">
              Simplified-English recap: Use minimum lawful force, communicate
              clearly, and document actions with page-cited evidence.
            </p>
          </article>
        )}
      </div>

      <div className="feature-grid">
        <CameraCapture onCapture={setImageB64} hasCapture={Boolean(imageB64)} />
        <CitationPopover citation={response?.citations[0]} />
        <PriorityTooltip rationale={response?.priority_rationale} />
      </div>
    </section>
  );
}

export default AskMode;

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, ImageIcon, MessageSquareQuote, Shapes } from 'lucide-react';

import { askTutor, isTutorLiveConfigured } from '../api/tutorClient';
import CameraCapture from '../components/tier1/CameraCapture';
import CitationPopover from '../components/tier1/CitationPopover';
import PriorityTooltip from '../components/tier1/PriorityTooltip';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import type { TutorResponse } from '../lib/types';

export default function TextTutorPage() {
  const [question, setQuestion] = useState(
    'When am I allowed to physically restrain someone?',
  );
  const [includeSceneImage, setIncludeSceneImage] = useState(true);
  const [includeDiagram, setIncludeDiagram] = useState<'auto' | 'always' | 'never'>('auto');
  const [response, setResponse] = useState<TutorResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageB64, setImageB64] = useState<string | undefined>(undefined);

  const liveConfigured = isTutorLiveConfigured();

  async function handleSubmit(): Promise<void> {
    setIsLoading(true);
    setError(null);
    try {
      setResponse(
        await askTutor(question, {
          image_b64: imageB64,
          include_diagram: includeDiagram,
          include_scene_image: includeSceneImage ? 'auto' : 'never',
        }),
      );
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
    <div className="page-stack">
      <section className="page-intro">
        <h1>Text Tutor</h1>
        <p>
          Ask a security-guard exam question; the tutor answers in simplified English and cites the
          Alberta manual by page. Optional scene images and diagrams come from the same RAG pipeline
          as the CLI.
        </p>
        {!liveConfigured && (
          <p className="config-banner" role="status">
            <strong>Backend not configured for live calls.</strong> Set{' '}
            <code className="inline-code">VITE_TUTOR_API_URL</code> (Lambda Function URL) or{' '}
            <code className="inline-code">VITE_API_BASE_URL</code> (uses <code className="inline-code">/tutor</code>)
            in <code className="inline-code">frontend/.env.local</code>, or set{' '}
            <code className="inline-code">VITE_USE_MOCK=1</code> for local mock data.
          </p>
        )}
        {import.meta.env.VITE_USE_MOCK === '1' && (
          <p className="field-hint" role="status">
            Using mock tutor responses (VITE_USE_MOCK=1).
          </p>
        )}
      </section>

      <div className="text-tutor-layout">
        <Card className="tutor-ask-card">
          <CardHeader>
            <div className="icon-wrap" aria-hidden="true">
              <MessageSquareQuote size={18} />
            </div>
            <CardTitle>Ask the RAG tutor</CardTitle>
            <CardDescription>
              Answers stay in simplified English with page citations.
            </CardDescription>
          </CardHeader>
          <CardContent className="tutor-ask-content">
            <label className="tutor-check">
              <input
                type="checkbox"
                checked={includeSceneImage}
                onChange={(e) => setIncludeSceneImage(e.target.checked)}
              />
              Include Bedrock scene image (when the model is enabled)
            </label>
            <div className="tutor-select-row">
              <label htmlFor="diagram-mode">SVG diagram</label>
              <select
                id="diagram-mode"
                className="tutor-select"
                value={includeDiagram}
                onChange={(e) =>
                  setIncludeDiagram(e.target.value as 'auto' | 'always' | 'never')
                }
              >
                <option value="auto">auto (model decides)</option>
                <option value="always">always</option>
                <option value="never">never</option>
              </select>
            </div>
            <textarea
              className="tutor-textarea"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              rows={5}
            />
            <div className="tutor-actions">
              <Button disabled={isLoading} onClick={handleSubmit} type="button">
                {isLoading ? 'Asking…' : 'Ask'}
              </Button>
            </div>
            {error && <p className="error">{error}</p>}

            {response && (
              <article className="answer-card tutor-answer">
                <h3>Answer (simplified English)</h3>
                <p className="tutor-answer-text">{response.answer}</p>
              </article>
            )}

            {response && response.glossary_terms.length > 0 && (
              <div className="glossary-block">
                <h4>
                  <BookOpen className="inline-icon" size={16} aria-hidden />
                  Glossary
                </h4>
                <ul className="glossary-list">
                  {response.glossary_terms.map((g, idx) => (
                    <li key={`${g.term}-${idx}`}>
                      <strong>{g.term}:</strong> {g.plain_english_definition}
                      {g.page_number != null && (
                        <span className="glossary-page"> (manual p. {g.page_number})</span>
                        )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="tutor-side-grid">
          <CameraCapture onCapture={setImageB64} hasCapture={Boolean(imageB64)} />
          {response && (
            <PriorityTooltip rationale={response.priority_rationale} priority={response.priority} />
          )}
          {!response && (
            <section className="feature-card">
              <p className="feature-id">F8</p>
              <h3>Exam priority</h3>
              <p className="field-hint">Ask a question to see why the topic matters for the exam.</p>
            </section>
          )}

          {response?.citations.map((c, i) => (
            <CitationPopover
              key={`${c.chunk_id ?? 'p' + c.page_number}-${i}`}
              citation={c}
            />
          ))}

          {response?.svg && (
            <Card>
              <CardHeader>
                <div className="icon-wrap" aria-hidden="true">
                  <Shapes size={18} />
                </div>
                <CardTitle>Diagram (SVG)</CardTitle>
                <CardDescription>Inline diagram from the tutor. Review before production use.</CardDescription>
              </CardHeader>
              <CardContent>
                <div
                  className="tutor-svg-wrap"
                  // eslint-disable-next-line react/no-danger -- tutor SVG is from our Bedrock stack; add sanitizer in production
                  dangerouslySetInnerHTML={{ __html: response.svg }}
                />
              </CardContent>
            </Card>
          )}

          {response?.scene_png_b64 && (
            <Card>
              <CardHeader>
                <div className="icon-wrap" aria-hidden="true">
                  <ImageIcon size={18} />
                </div>
                <CardTitle>Scene image</CardTitle>
                <CardDescription>Photorealistic training scene (no on-image text from the model).</CardDescription>
              </CardHeader>
              <CardContent>
                <img
                  className="tutor-scene-image"
                  src={`data:image/jpeg;base64,${response.scene_png_b64}`}
                  alt="Generated training scenario"
                />
                {response.scene_image_prompt && (
                  <p className="field-hint scene-prompt-debug">
                    <strong>Scene prompt (debug):</strong> {response.scene_image_prompt}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {response?.scene_image_error && !response?.scene_png_b64 && (
            <p className="error scene-image-error" role="alert">
              Scene image: {response.scene_image_error}
            </p>
          )}

          <Card>
            <CardHeader>
              <MessageSquareQuote size={18} className="inline-icon" />
              <CardTitle>Design details</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Open the deep-link modal to inspect how citations and priority scoring are explained.
              </CardDescription>
              <Button asChild variant="secondary" size="sm">
                <Link to="/text-tutor?modal=design-rules">Open details modal</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

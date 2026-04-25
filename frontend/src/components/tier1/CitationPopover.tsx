import type { Citation } from '../../lib/types';

type CitationPopoverProps = {
  citation?: Citation;
};

function CitationPopover({ citation }: CitationPopoverProps) {
  return (
    <section className="feature-card">
      <p className="feature-id">F4</p>
      <h3>Citation verification</h3>
      <details>
        <summary>Open cited manual chunk</summary>
        <p>
          Page {citation?.page_number ?? 43}:{' '}
          {citation?.chunk_text ??
            'Verbatim chunk text from citations[] will render here.'}
        </p>
      </details>
    </section>
  );
}

export default CitationPopover;

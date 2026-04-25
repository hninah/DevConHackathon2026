import { useState } from 'react';
import type { Citation } from '../../lib/types';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';

type CitationPopoverProps = {
  citation?: Citation;
};

function CitationPopover({ citation }: CitationPopoverProps) {
  const [open, setOpen] = useState(false);

  return (
    <section className="feature-card">
      <p className="feature-id">F4</p>
      <h3>Citation verification</h3>
      <p>Click to verify the exact manual chunk used for this answer.</p>
      <Button size="sm" variant="secondary" type="button" onClick={() => setOpen(true)}>
        View cited chunk — page {citation?.page_number ?? 43}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent aria-describedby="citation-chunk-desc">
          <DialogHeader>
            <DialogTitle>Manual — page {citation?.page_number ?? 43}</DialogTitle>
            <DialogDescription id="citation-chunk-desc">
              Verbatim chunk retrieved from the Alberta Basic Security Guard manual.
            </DialogDescription>
          </DialogHeader>
          <blockquote className="citation-block">
            {citation?.chunk_text ??
              'Verbatim chunk text will appear here once the tutor responds.'}
          </blockquote>
        </DialogContent>
      </Dialog>
    </section>
  );
}

export default CitationPopover;

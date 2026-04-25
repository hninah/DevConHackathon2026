import { useMemo } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import type { ModalSpec } from '../lib/siteContent';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';

type DeepLinkModalProps = {
  specs: ModalSpec[];
};

export default function DeepLinkModal({ specs }: DeepLinkModalProps) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const modalId = searchParams.get('modal');

  const spec = useMemo(() => specs.find((item) => item.id === modalId), [modalId, specs]);

  function handleOpenChange(open: boolean): void {
    if (open) return;
    const next = new URLSearchParams(searchParams);
    next.delete('modal');
    navigate(
      {
        pathname: location.pathname,
        search: next.toString() ? `?${next.toString()}` : '',
      },
      { replace: true },
    );
  }

  return (
    <Dialog open={Boolean(spec)} onOpenChange={handleOpenChange}>
      <DialogContent aria-describedby="feature-modal-description">
        {spec ? (
          <>
            <DialogHeader>
              <DialogTitle>{spec.title}</DialogTitle>
              <DialogDescription id="feature-modal-description">
                {spec.details}
              </DialogDescription>
            </DialogHeader>
            <ul className="checklist">
              {spec.checklist.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <div className="dialog-actions">
              <Button type="button" variant="secondary" onClick={() => handleOpenChange(false)}>
                Close and return
              </Button>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

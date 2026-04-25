import * as DialogPrimitive from '@radix-ui/react-dialog';
import type { ComponentPropsWithoutRef } from 'react';
import { X } from 'lucide-react';

import { cn } from '../../lib/utils';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogPortal = DialogPrimitive.Portal;
export const DialogClose = DialogPrimitive.Close;

export function DialogOverlay({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      className={cn('ui-dialog__overlay', className)}
      {...props}
    />
  );
}

export function DialogContent({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<typeof DialogPrimitive.Content>) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content className={cn('ui-dialog__content', className)} {...props}>
        {children}
        <DialogPrimitive.Close className="ui-dialog__close">
          <X aria-hidden="true" size={18} />
          <span className="sr-only">Close dialog</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

export function DialogHeader({
  className,
  ...props
}: ComponentPropsWithoutRef<'div'>) {
  return <div className={cn('ui-dialog__header', className)} {...props} />;
}

export function DialogTitle({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cn('ui-dialog__title', className)} {...props} />;
}

export function DialogDescription({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      className={cn('ui-dialog__description', className)}
      {...props}
    />
  );
}

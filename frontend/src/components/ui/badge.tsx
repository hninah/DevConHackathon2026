import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';

import { cn } from '../../lib/utils';

const badgeVariants = cva('ui-badge', {
  variants: {
    variant: {
      primary: 'ui-badge--primary',
      neutral: 'ui-badge--neutral',
      success: 'ui-badge--success',
      warning: 'ui-badge--warning',
    },
  },
  defaultVariants: {
    variant: 'neutral',
  },
});

type BadgeProps = HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

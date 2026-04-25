import { useState } from 'react';

import type { ExamPriority } from '../../lib/types';

const PRIORITY_LABEL: Record<ExamPriority, string> = {
  HIGH: 'Exam priority: HIGH',
  MEDIUM: 'Exam priority: MEDIUM',
  BACKGROUND: 'Exam focus: background',
};

type PriorityTooltipProps = {
  rationale?: string;
  priority?: ExamPriority;
};

function PriorityTooltip({ rationale, priority = 'HIGH' }: PriorityTooltipProps) {
  const [visible, setVisible] = useState(false);

  return (
    <section className="feature-card">
      <p className="feature-id">F8</p>
      <h3>Why is this on the exam?</h3>
      <div className="tooltip-host">
        <span
          className="priority-chip"
          role="button"
          tabIndex={0}
          aria-describedby={visible ? 'priority-tip' : undefined}
          onMouseEnter={() => setVisible(true)}
          onMouseLeave={() => setVisible(false)}
          onFocus={() => setVisible(true)}
          onBlur={() => setVisible(false)}
        >
          {PRIORITY_LABEL[priority]}
        </span>
        {visible && (
          <div id="priority-tip" role="tooltip" className="priority-tooltip">
            {rationale ?? 'This topic is prioritised because it appears frequently on the provincial exam.'}
          </div>
        )}
      </div>
    </section>
  );
}

export default PriorityTooltip;

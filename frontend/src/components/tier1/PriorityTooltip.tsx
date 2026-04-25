import { useState } from 'react';

type PriorityTooltipProps = {
  rationale?: string;
};

function PriorityTooltip({ rationale }: PriorityTooltipProps) {
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
          Exam priority: HIGH
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

type PriorityTooltipProps = {
  rationale?: string;
};

function PriorityTooltip({ rationale }: PriorityTooltipProps) {
  return (
    <section className="feature-card">
      <p className="feature-id">F8</p>
      <h3>Why is this on the exam?</h3>
      <span
        className="priority-chip"
        title={
          rationale ??
          'Priority rationale from /tutor will appear here on hover or tap.'
        }
      >
        Exam priority: HIGH
      </span>
    </section>
  );
}

export default PriorityTooltip;

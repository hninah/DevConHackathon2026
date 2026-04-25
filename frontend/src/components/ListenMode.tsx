function ListenMode() {
  return (
    <section className="mode-panel">
      <div className="primary-card">
        <p className="eyebrow">Listen mode</p>
        <h2>Adaptive delivery, audio and visual support</h2>
        <p>
          Use audio playback for difficult sections, then pair it with visual
          diagrams from roleplay scenarios for reinforcement.
        </p>
        <p className="field-hint">Audio is intended for recap after simplified-English tutoring.</p>
        <audio controls />
      </div>
    </section>
  );
}

export default ListenMode;

import type { Mode } from '../lib/types';

type ModeSwitcherProps = {
  activeMode: Mode;
  onChange: (mode: Mode) => void;
};

const MODES: Array<{ id: Mode; label: string; description: string }> = [
  { id: 'ask', label: 'Ask', description: 'RAG tutor' },
  { id: 'practice', label: 'Practice', description: 'Scenarios' },
  { id: 'listen', label: 'Listen', description: 'Polly audio' },
];

function ModeSwitcher({ activeMode, onChange }: ModeSwitcherProps) {
  return (
    <nav className="mode-switcher" aria-label="Learning mode">
      {MODES.map((mode) => (
        <button
          className={mode.id === activeMode ? 'mode active' : 'mode'}
          key={mode.id}
          onClick={() => onChange(mode.id)}
          type="button"
        >
          <span>{mode.label}</span>
          <small>{mode.description}</small>
        </button>
      ))}
    </nav>
  );
}

export default ModeSwitcher;

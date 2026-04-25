import type { Mode } from '../lib/types';

type ModeSwitcherProps = {
  activeMode: Mode;
  onChange: (mode: Mode) => void;
};

const MODES: Array<{ id: Mode; label: string }> = [
  { id: 'text-tutor', label: 'Text Tutor' },
  { id: 'practice', label: 'Exam Practice' },
  { id: 'roleplay', label: 'Roleplay' },
];

function ModeSwitcher({ activeMode, onChange }: ModeSwitcherProps) {
  return (
    <nav className="mode-switcher" aria-label="Learning mode tabs">
      <div className="mode-switcher__brand">
        <img className="mode-switcher__logo" src="/favicon.svg" alt="SecurePass" />
        <span>SecurePass</span>
      </div>
      <div className="mode-switcher__tabs" role="tablist" aria-label="Primary sections">
        {MODES.map((mode) => (
          <button
            aria-selected={mode.id === activeMode}
            className={mode.id === activeMode ? 'mode active' : 'mode'}
            key={mode.id}
            onClick={() => onChange(mode.id)}
            role="tab"
            type="button"
          >
            <span>{mode.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

export default ModeSwitcher;

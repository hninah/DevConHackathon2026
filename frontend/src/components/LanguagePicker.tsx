import { useEffect, useState } from 'react';

import type { LanguageOption } from '../lib/types';

type LanguagePickerProps = {
  value: string;
  onChange: (language: string) => void;
};

function LanguagePicker({ value, onChange }: LanguagePickerProps) {
  const [languages, setLanguages] = useState<LanguageOption[]>([]);

  useEffect(() => {
    fetch('/languages.json')
      .then((response) => response.json() as Promise<LanguageOption[]>)
      .then(setLanguages)
      .catch(() => {
        setLanguages([{ name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ' }]);
      });
  }, []);

  return (
    <label className="field">
      Study language
      <input
        list="language-options"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search 100+ languages"
      />
      <datalist id="language-options">
        {languages.map((language) => (
          <option
            key={language.name}
            value={language.name}
            label={`${language.nativeName} - ${language.name}`}
          />
        ))}
      </datalist>
      <span className="field-hint">
        {languages.length || '100+'} languages available through Claude.
      </span>
    </label>
  );
}

export default LanguagePicker;

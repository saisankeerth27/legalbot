import React from "react";
import { Globe } from "lucide-react";

const LANGUAGES = ["English", "Hindi", "Telugu"] as const;

interface LanguageSelectorProps {
  language: string;
  onChange: (lang: string) => void;
}

const LanguageSelector: React.FC<LanguageSelectorProps> = ({ language, onChange }) => {
  return (
    <div className="flex items-center gap-2">
      <Globe className="h-4 w-4 text-muted-foreground" />
      <select
        value={language}
        onChange={(e) => onChange(e.target.value)}
        className="bg-secondary text-foreground text-sm rounded-lg px-2 py-1.5 border border-border outline-none focus:ring-1 focus:ring-ring cursor-pointer"
      >
        {LANGUAGES.map((lang) => (
          <option key={lang} value={lang}>
            {lang}
          </option>
        ))}
      </select>
    </div>
  );
};

export default LanguageSelector;

import React from "react";
import { Globe } from "lucide-react";

const LANGUAGES = ["English", "Hindi", "Telugu"] as const;

interface LanguageSelectorProps {
  language: string;
  onChange: (lang: string) => void;
}

const LanguageSelector: React.FC<LanguageSelectorProps> = ({ language, onChange }) => {
  return (
    <div className="flex items-center gap-1 sm:gap-2">
      <Globe className="h-4 w-4 text-muted-foreground hidden sm:block" />
      <select
        value={language}
        onChange={(e) => onChange(e.target.value)}
        className="bg-secondary text-foreground text-xs sm:text-sm rounded-lg px-1.5 sm:px-2 py-1.5 border border-border outline-none focus:ring-1 focus:ring-ring cursor-pointer touch-manipulation"
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

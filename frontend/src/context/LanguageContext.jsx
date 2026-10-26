import { useEffect, useState } from "react";
import { LanguageContext } from "./language";
import {
  LANGUAGE_KEY,
  languages,
  storedLanguage,
  translate,
  courseText,
} from "../i18n/translate";
export function LanguageProvider({ children }) {
  const [language, updateLanguage] = useState(storedLanguage);
  function setLanguage(next) {
    if (languages.includes(next)) updateLanguage(next);
  }
  useEffect(() => {
    document.documentElement.lang = language;
    document.title =
      language === "th"
        ? "KU-PAS – ระบบค้นหาวิชาและจัดตารางเรียน"
        : "KU-PAS – Course Discovery";
    try {
      localStorage.setItem(LANGUAGE_KEY, language);
    } catch {
      /* Switching still works if browser storage is disabled. */
    }
  }, [language]);
  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        t: (key, params) => translate(key, language, params),
        courseText: (course, kind) => courseText(course, kind, language),
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

import { createContext } from "react";
import { translate, courseText } from "../i18n/translate";
export const LanguageContext = createContext({
  language: "en",
  setLanguage: () => {},
  t: translate,
  courseText: (course, kind) => courseText(course, kind, "en"),
});

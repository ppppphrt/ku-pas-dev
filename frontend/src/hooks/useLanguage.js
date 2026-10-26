import { useContext } from "react";
import { LanguageContext } from "../context/language";
export const useLanguage = () => useContext(LanguageContext);

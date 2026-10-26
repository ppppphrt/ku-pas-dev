import Icon from "./Icon";
import { useLanguage } from "../hooks/useLanguage";
import { useState } from "react";
export default function SearchBar({
  query = "",
  mode,
  onSearch,
  loading,
  semanticReady,
}) {
  const { t } = useLanguage();
  const [input, setInput] = useState(query);
  const [chosenMode, setChosenMode] = useState(mode);
  return (
    <form
      className="search-row"
      onSubmit={(event) => {
        event.preventDefault();
        if (input.trim()) onSearch(input.trim(), chosenMode);
      }}
    >
      <div className="search-toggle" aria-label={t("Search mode")}>
        {[
          ["search", "Search"],
          ["ask", "Ask"],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={chosenMode === value}
            disabled={value === "ask" && !semanticReady}
            onClick={() => setChosenMode(value)}
          >
            {t(label)}
          </button>
        ))}
      </div>
      <label className="search-field">
        <span className="sr-only">{t("Course search")}</span>
        <input
          name="query"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            chosenMode === "ask"
              ? t("Describe what you want to learn…")
              : t("Search by course code or name…")
          }
          maxLength={1000}
        />
      </label>
      <button className="primary" disabled={!input.trim() || loading}>
        {t("Search courses")}
        <Icon name="arrow" />
      </button>
    </form>
  );
}

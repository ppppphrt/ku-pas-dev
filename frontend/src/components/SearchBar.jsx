import Icon from "./Icon";
import { useLanguage } from "../hooks/useLanguage";
import { useState } from "react";
export default function SearchBar({ query = "", onSearch, loading }) {
  const { t } = useLanguage();
  const [input, setInput] = useState(query);
  return (
    <form
      className="search-row"
      onSubmit={(event) => {
        event.preventDefault();
        if (input.trim()) onSearch(input.trim());
      }}
    >
      <label className="search-field">
        <span className="sr-only">{t("Course search")}</span>
        <input
          name="query"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("Search by course code or name…")}
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

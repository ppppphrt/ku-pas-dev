import { useState } from "react";
export default function SearchBar({
  query = "",
  mode,
  onSearch,
  loading,
  semanticReady,
}) {
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
      <div className="search-toggle" aria-label="Search mode">
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
            {label}
          </button>
        ))}
      </div>
      <label className="search-field">
        <span className="sr-only">Course search</span>
        <input
          name="query"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            chosenMode === "ask"
              ? "Describe what you want to learn…"
              : "Search by course code or name…"
          }
          maxLength={1000}
        />
      </label>
      <button className="primary" disabled={!input.trim() || loading}>
        Search courses
      </button>
    </form>
  );
}

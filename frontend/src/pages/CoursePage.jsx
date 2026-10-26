import studySpace from "../assets/study-space.svg";
import Icon from "../components/Icon";
import { useLanguage } from "../hooks/useLanguage";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { discover, errorMessage } from "../services/courseApi";
import SearchBar from "../components/SearchBar";
import CourseCard from "../components/CourseCard";
import FiltersPanel from "../components/FiltersPanel";
import { EmptyState, Loading } from "../components/ui";
const emptyFilters = {
  faculty: "",
  min_credits: "",
  max_credits: "",
  days: [],
  start_time: "",
  end_time: "",
  offered_only: false,
};
function filterValues(params) {
  return {
    ...emptyFilters,
    ...Object.fromEntries(
      ["faculty", "min_credits", "max_credits", "start_time", "end_time"].map(
        (key) => [key, params.get(key) || ""],
      ),
    ),
    days: params.getAll("days"),
    offered_only: params.get("offered_only") === "true",
  };
}
export default function CoursePage({ metadata }) {
  const [params, setParams] = useSearchParams();
  const serialized = params.toString();
  useEffect(() => {
    sessionStorage.setItem(
      "ku-discovery-query",
      serialized ? `?${serialized}` : "",
    );
  }, [serialized]);
  return (
    <Discovery
      key={params.toString()}
      params={params}
      setParams={setParams}
      metadata={metadata}
    />
  );
}
function Discovery({ params, setParams, metadata }) {
  const { t } = useLanguage();
  const query = params.get("q") || "";
  const mode = params.get("mode") === "ask" ? "ask" : "search";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const [draft, setDraft] = useState(() => filterValues(params));
  const [response, setResponse] = useState(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const loading = !response && !error;
  const serialized = params.toString();
  useEffect(() => {
    const controller = new AbortController();
    discover({
      query,
      mode,
      page,
      filters: filterValues(new URLSearchParams(serialized)),
      signal: controller.signal,
    })
      .then(setResponse)
      .catch((e) => {
        if (e.code !== "ERR_CANCELED") setError(errorMessage(e));
      });
    return () => controller.abort();
  }, [query, mode, page, serialized, retry]);
  function update(next) {
    setParams(next);
  }
  function search(value, chosenMode) {
    const next = new URLSearchParams(params);
    next.set("q", value);
    next.set("mode", chosenMode);
    next.delete("page");
    update(next);
  }
  function apply() {
    const next = new URLSearchParams();
    if (query) next.set("q", query);
    next.set("mode", mode);
    for (const [key, value] of Object.entries(draft)) {
      if (Array.isArray(value)) value.forEach((v) => next.append(key, v));
      else if (value !== "") next.set(key, String(value));
    }
    update(next);
  }
  const active = Object.entries(filterValues(params)).filter(([, value]) =>
    Array.isArray(value) ? value.length : Boolean(value),
  ).length;
  return (
    <main id="main">
      <header className="page-header">
        <div className="hero-main">
          <div className="hero-copy">
            <p className="eyebrow">{t("Discover your next course")}</p>
            <h1>
              {t("Your next chapter.")}
              <br />
              <span>{t("Your kind of course.")}</span>
            </h1>
            <p className="hero-description">
              {t(
                "Find something you love learning. Build a timetable that leaves room for life.",
              )}
            </p>
            <Link className="hero-link" to="/chat">
              <Icon name="chat" />
              {t("Not sure where to start? Try GE Chat")}
              <Icon name="arrow" />
            </Link>
          </div>
          <img
            className="hero-art"
            src={studySpace}
            alt=""
            width="600"
            height="430"
          />
        </div>
        <div className="search-surface">
          <div className="search-caption">
            <Icon name="search" />
            <h2>{t("Course Discovery")}</h2>
            <span>{t("A little curiosity goes a long way.")}</span>
          </div>
          <SearchBar
            query={query}
            mode={mode}
            onSearch={search}
            loading={loading}
            semanticReady={metadata.semantic_ready}
          />
          {!metadata.semantic_ready && (
            <p>
              {t(
                "Ask mode is unavailable while the semantic model is offline. Search by code or name.",
              )}
            </p>
          )}
        </div>
      </header>
      <div className="body">
        <FiltersPanel
          values={draft}
          onChange={setDraft}
          onApply={apply}
          onReset={() => {
            const next = new URLSearchParams();
            if (query) next.set("q", query);
            next.set("mode", mode);
            update(next);
          }}
          faculties={metadata.faculties}
        />
        <section
          className="courses"
          aria-label={t("Course results")}
          aria-busy={loading}
        >
          {loading && <Loading text={t("Finding courses…")} />}
          {error && (
            <div className="error" role="alert">
              <p>{t(error)}</p>
              <button
                onClick={() => {
                  setError("");
                  setRetry((v) => v + 1);
                }}
              >
                {t("Retry")}
              </button>
            </div>
          )}
          {response && (
            <>
              <p className="results-summary" role="status">
                {response.total_results.toLocaleString()}
                {t(" courses · ")}
                {active} {t("active filters · Page ")}
                {page}
              </p>
              {!response.results.length && (
                <EmptyState>
                  {t(
                    "No courses match. Try another query or reset your filters.",
                  )}
                </EmptyState>
              )}
              {response.results.map((course) => (
                <CourseCard
                  key={course.subject_code}
                  course={course}
                  mode={mode}
                  query={query}
                />
              ))}
              <div className="pagination">
                <button
                  disabled={page === 1}
                  onClick={() => {
                    const next = new URLSearchParams(params);
                    next.set("page", page - 1);
                    update(next);
                  }}
                >
                  {t("Previous page")}
                </button>
                <button
                  disabled={!response.has_more}
                  onClick={() => {
                    const next = new URLSearchParams(params);
                    next.set("page", page + 1);
                    update(next);
                  }}
                >
                  {t("Next page")}
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}

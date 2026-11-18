import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLanguage } from "../hooks/useLanguage";
import { discover, errorMessage } from "../services/courseApi";
import { arrangeRequired, requiredSections } from "../utils/arrangeRequired";

export default function RequiredCourses({ timetable, onBack }) {
  const { t, courseText } = useLanguage();
  const navigate = useNavigate();
  const [draft, setDraft] = useState("");
  const [rows, setRows] = useState([]);
  const [plan, setPlan] = useState(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  async function lookup(event) {
    event.preventDefault();
    const terms = [
      ...new Set(
        draft
          .split(/[\n,;]+/)
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    ];
    if (!terms.length || terms.length > 8) {
      setError(t("Enter 1–8 courses, one per line."));
      return;
    }
    setWorking(true);
    setError("");
    setRows([]);
    setPlan(null);
    try {
      setRows(
        await Promise.all(
          terms.map(async (query) => {
            const { results } = await discover({
              query,
              mode: "keyword",
              filters: {},
            });
            const choices = results.filter(
              (course) => course.campus === "บางเขน",
            );
            const exact = choices.filter((course) =>
              [
                course.subject_code,
                course.subject_name_th,
                course.subject_name_en,
              ].some(
                (value) => value?.trim().toLowerCase() === query.toLowerCase(),
              ),
            );
            return {
              query,
              choices,
              course:
                exact.length === 1
                  ? exact[0]
                  : choices.length === 1
                    ? choices[0]
                    : null,
              locked: "",
            };
          }),
        ),
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setWorking(false);
    }
  }
  function update(index, patch) {
    setPlan(null);
    setRows(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }
  return (
    <main id="main" className="container">
      <button type="button" onClick={onBack}>
        {t("Back to choices")}
      </button>
      <h1>{t("Plan required courses")}</h1>
      <form onSubmit={lookup}>
        <label>
          {t("Enter course names or codes, one per line.")}
          <textarea
            rows={5}
            value={draft}
            maxLength={1000}
            disabled={working}
            onChange={(e) => {
              setDraft(e.target.value);
              setRows([]);
              setPlan(null);
              setError("");
            }}
          />
        </label>
        <button className="primary" disabled={working || !draft.trim()}>
          {t("Find required courses")}
        </button>
      </form>
      {working && <p role="status">{t("กำลังค้นหา…")}</p>}
      {error && <p role="alert">{error}</p>}
      {rows.map(({ query, choices, course, locked }, i) => {
        const sections = course ? requiredSections(course) : [];
        return (
          <div key={query} className="panel">
            <label>
              {query}
              <select
                value={course?.subject_code || ""}
                onChange={(e) =>
                  update(i, {
                    course: choices.find(
                      (option) => option.subject_code === e.target.value,
                    ),
                    locked: "",
                  })
                }
              >
                <option value="">{t("Select a matching course")}</option>
                {choices.map((option) => (
                  <option key={option.subject_code} value={option.subject_code}>
                    {option.subject_code} · {courseText(option, "name")}
                  </option>
                ))}
              </select>
            </label>
            {!choices.length && (
              <p>
                {t(
                  "No matching course in the Bangkhen catalog. Check the full code.",
                )}
              </p>
            )}
            {course && !sections.length && (
              <p>
                {t(
                  "Course found. This snapshot has no section with enough information for timetable planning.",
                )}
              </p>
            )}
            {sections.length > 0 && (
              <label>
                {t("Section ")}
                <select
                  value={locked}
                  onChange={(e) => update(i, { locked: e.target.value })}
                >
                  <option value="">{t("Choose a section for me")}</option>
                  {sections.map((section) => (
                    <option key={section.section_id} value={section.section_id}>
                      {section.section_code} ·{" "}
                      {section.time_slots
                        .map(
                          (slot) => `${t(slot.day)} ${slot.start}–${slot.end}`,
                        )
                        .join(", ")}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        );
      })}
      {rows.length > 0 && (
        <button
          disabled={
            !rows.every(
              ({ course }) => course && requiredSections(course).length,
            ) ||
            !timetable.ready ||
            timetable.busy
          }
          onClick={() => {
            const result = arrangeRequired(rows, timetable.items);
            setPlan(result);
            setError(
              result
                ? ""
                : t(
                    "Could not fit all required courses. Check duplicates, locked sections, or existing classes.",
                  ),
            );
          }}
        >
          {t("Arrange required courses")}
        </button>
      )}
      {plan && (
        <section>
          <h2>{t("Review your base timetable")}</h2>
          <ul>
            {plan.map(({ course, section }) => (
              <li key={course.subject_code}>
                {courseText(course, "name")} · {t("Section ")}
                {section.section_code} ·{" "}
                {section.time_slots
                  .map((slot) => `${t(slot.day)} ${slot.start}–${slot.end}`)
                  .join(", ")}
              </li>
            ))}
          </ul>
          <button
            className="primary"
            disabled={timetable.busy}
            onClick={async () => {
              if (await timetable.addPlan(plan)) navigate("/chat?ge=fit");
              else
                setError(
                  t(
                    "Could not save this plan. Check conflicts and the credit limit.",
                  ),
                );
            }}
          >
            {t("Confirm timetable and find GE")}
          </button>
        </section>
      )}
      {timetable.items.length > 0 && (
        <p>
          <Link to="/timetable">{t("Review your saved timetable")}</Link>
        </p>
      )}
    </main>
  );
}

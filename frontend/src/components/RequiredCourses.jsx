import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLanguage } from "../hooks/useLanguage";
import { discover, errorMessage } from "../services/courseApi";
import { arrangeRequired, requiredSections } from "../utils/arrangeRequired";

function registeredSection(course, sectionCode) {
  const matches = course.sections.filter(
    (section) =>
      section.campus === "บางเขน" &&
      (!sectionCode || section.section_code === sectionCode),
  );
  const [section] = matches;
  return matches.length === 1 && requiredSections(course).includes(section)
    ? section.section_id
    : "";
}

export default function RequiredCourses({
  timetable,
  onBack,
  onSubmitted,
  onAdded,
}) {
  const registered = Boolean(onAdded);
  const { t, courseText } = useLanguage();
  const navigate = useNavigate();
  const [draft, setDraft] = useState("");
  const [rows, setRows] = useState([]);
  const [plan, setPlan] = useState(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const request = useRef(null);
  useEffect(() => () => request.current?.abort(), []);

  async function saveRegistered(selected, signal) {
    const items = selected.map(({ course, locked }) => ({
      course,
      section: requiredSections(course).find(
        (section) => section.section_id === locked,
      ),
    }));
    const codes = items.map(({ course }) => course.subject_code);
    if (new Set(codes).size !== codes.length) {
      setError(t("Enter each course only once."));
      return;
    }
    const saved = await timetable.addPlan(items);
    if (signal?.aborted) return;
    if (saved) {
      setRows([]);
      setDraft("");
      onAdded(items);
    } else {
      setError(
        t("Could not save this plan. Check conflicts and the credit limit."),
      );
    }
  }

  async function lookup(event) {
    event.preventDefault();
    if (request.current || working || timetable.busy) return;
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
    const controller = new AbortController();
    request.current = controller;
    setWorking(true);
    setError("");
    onSubmitted?.(draft.trim());
    setRows([]);
    setPlan(null);
    try {
      const found = await Promise.all(
        terms.map(async (input) => {
          const sectionSuffix = registered
            ? input.match(
                /\s+(?:หมู่(?:เรียน)?|section|sec\.?)\s*[:#]?\s*(\d+)$/i,
              )
            : null;
          const query = sectionSuffix
            ? input.slice(0, sectionSuffix.index).trim()
            : input;
          const { results, has_more } = await discover({
            query,
            mode: "keyword",
            filters: {},
            signal: controller.signal,
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
          const match =
            exact.length === 1
              ? exact[0]
              : choices.length === 1
                ? choices[0]
                : null;
          const autoMatch =
            !has_more &&
            (exact.length === 1 ||
              (match &&
                /^\d{8}$/.test(query) &&
                match.subject_code.split("-")[0] === query));
          return {
            query: input,
            choices,
            course: match,
            locked:
              registered && match
                ? registeredSection(match, sectionSuffix?.[1])
                : "",
            autoMatch,
            sectionCode: sectionSuffix?.[1],
          };
        }),
      );
      if (controller.signal.aborted) return;
      setRows(found);
      if (registered && found.every((row) => row.autoMatch && row.locked)) {
        await saveRegistered(found, controller.signal);
      }
    } catch (e) {
      if (!controller.signal.aborted) setError(errorMessage(e));
    } finally {
      request.current = null;
      if (!controller.signal.aborted) setWorking(false);
    }
  }
  function update(index, patch) {
    setPlan(null);
    setRows(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }
  return (
    <section className="panel" aria-labelledby="required-courses-title">
      <button
        type="button"
        onClick={onBack}
        disabled={working || timetable.busy}
      >
        {t("Back to choices")}
      </button>
      <h2 id="required-courses-title">
        {t(registered ? "Add registered courses" : "Plan required courses")}
      </h2>
      <form onSubmit={lookup}>
        <label>
          {t("Enter course names or codes, one per line.")}
          <textarea
            rows={registered ? 3 : 5}
            value={draft}
            maxLength={1000}
            disabled={working || timetable.busy}
            onChange={(e) => {
              setDraft(e.target.value);
              setRows([]);
              setPlan(null);
              setError("");
            }}
          />
        </label>
        <button
          className="primary"
          disabled={working || timetable.busy || !draft.trim()}
        >
          {t(
            registered
              ? "Find registered courses in the catalog"
              : "Find required courses",
          )}
        </button>
      </form>
      {working && <p role="status">{t("กำลังค้นหา…")}</p>}
      {error && <p role="alert">{error}</p>}
      {rows.map(({ query, choices, course, locked, sectionCode }, i) => {
        const sections = course ? requiredSections(course) : [];
        return (
          <div key={query} className="panel">
            <label>
              {query}
              <select
                value={course?.subject_code || ""}
                disabled={working || timetable.busy}
                onChange={(e) => {
                  const next = choices.find(
                    (option) => option.subject_code === e.target.value,
                  );
                  update(i, {
                    course: next,
                    locked:
                      registered && next
                        ? registeredSection(next, sectionCode)
                        : "",
                  });
                }}
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
            {registered && course && !locked && sections.length > 0 && (
              <p>
                {t(
                  sectionCode
                    ? "The section you entered could not be matched to one complete schedule. Review the options below."
                    : "Which section did you register for? Choose it below.",
                )}
              </p>
            )}
            {sections.length > 0 && (
              <label>
                {t("Section ")}
                <select
                  value={locked}
                  disabled={working || timetable.busy}
                  onChange={(e) => update(i, { locked: e.target.value })}
                >
                  <option value="">
                    {t(
                      registered
                        ? "Select the section you registered for"
                        : "Choose a section for me",
                    )}
                  </option>
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
      {registered && rows.length > 0 && (
        <button
          type="button"
          disabled={
            working ||
            timetable.busy ||
            !timetable.ready ||
            !rows.every(({ locked }) => locked)
          }
          onClick={async () => {
            setError("");
            await saveRegistered(rows);
          }}
        >
          {t("Add these courses to my timetable")}
        </button>
      )}
      {!registered && rows.length > 0 && (
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
          <h3>{t("Review your base timetable")}</h3>
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
    </section>
  );
}

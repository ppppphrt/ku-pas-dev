import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLanguage } from "../hooks/useLanguage";
import { discover, errorMessage } from "../services/courseApi";
import { arrangeRequired, requiredSections } from "../utils/arrangeRequired";
import "./RequiredCourses.css";

const MAX_COURSES = 8;
const MAX_COURSE_LENGTH = 1000;

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
  const [fields, setFields] = useState([{ id: 0, value: "" }]);
  const nextId = useRef(1);
  const inputs = useRef(new Map());
  const focusId = useRef(null);
  const [rows, setRows] = useState([]);
  const [plan, setPlan] = useState(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const request = useRef(null);
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    if (focusId.current !== null) {
      inputs.current.get(focusId.current)?.focus();
      focusId.current = null;
    }
  }, [fields]);

  const terms = [
    ...new Set(fields.map(({ value }) => value.trim()).filter(Boolean)),
  ];
  const disabled = working || timetable.busy;
  const atLimit = fields.length >= MAX_COURSES;

  function changeFields(next, focus = null) {
    focusId.current = focus;
    setFields(next);
    setRows([]);
    setPlan(null);
    setError("");
  }

  function addField() {
    if (atLimit || disabled) return;
    const id = nextId.current++;
    // Adding a blank field leaves existing results valid until the user edits it.
    focusId.current = id;
    setFields([...fields, { id, value: "" }]);
  }

  function handleEnter(event, index) {
    if (
      event.key !== "Enter" ||
      event.nativeEvent.isComposing ||
      event.keyCode === 229
    )
      return;
    event.preventDefault();
    const next = fields[index + 1];
    if (next) inputs.current.get(next.id)?.focus();
    else if (fields[index].value.trim()) addField();
  }

  function pasteCourses(event, index) {
    const pasted = event.clipboardData.getData("text");
    if (!/[\r\n]/.test(pasted.trim())) return;
    event.preventDefault();
    const { value, selectionStart, selectionEnd } = event.currentTarget;
    const combined =
      value.slice(0, selectionStart) +
      pasted.trim() +
      value.slice(selectionEnd);
    const values = combined
      .split(/[\r\n]+/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (fields.length - 1 + values.length > MAX_COURSES) {
      setError(t("You can enter up to 8 courses at a time."));
      return;
    }
    if (values.some((line) => line.length > MAX_COURSE_LENGTH)) {
      setError(t("One of the pasted course entries is too long."));
      return;
    }
    const pastedFields = values.map((value, i) => ({
      id: i === 0 ? fields[index].id : nextId.current++,
      value,
    }));
    changeFields(
      [...fields.slice(0, index), ...pastedFields, ...fields.slice(index + 1)],
      pastedFields.at(-1).id,
    );
  }

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
      setFields([{ id: nextId.current++, value: "" }]);
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
    if (!terms.length) return;
    const controller = new AbortController();
    request.current = controller;
    setWorking(true);
    setError("");
    onSubmitted?.(terms.join("\n"));
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
      <form className="required-course-form" onSubmit={lookup}>
        <div className="required-course-fields">
          {fields.map(({ id, value }, index) => (
            <div className="required-course-field" key={id}>
              <label>
                {t("Course name or code")} {index + 1}
                <input
                  type="text"
                  ref={(input) => {
                    if (input) inputs.current.set(id, input);
                    else inputs.current.delete(id);
                  }}
                  value={value}
                  placeholder={t(
                    registered
                      ? "e.g. 01219325-65 section 450"
                      : "e.g. 01219325-65 or Software Development Security",
                  )}
                  maxLength={MAX_COURSE_LENGTH}
                  disabled={disabled}
                  onChange={(event) =>
                    changeFields(
                      fields.map((field) =>
                        field.id === id
                          ? { ...field, value: event.target.value }
                          : field,
                      ),
                    )
                  }
                  onKeyDown={(event) => handleEnter(event, index)}
                  onPaste={(event) => pasteCourses(event, index)}
                />
              </label>
              {fields.length > 1 && (
                <button
                  type="button"
                  disabled={disabled}
                  aria-label={`${t("Remove course")} ${index + 1}`}
                  onClick={() =>
                    changeFields(
                      fields.filter((field) => field.id !== id),
                      (fields[index + 1] || fields[index - 1]).id,
                    )
                  }
                >
                  {t("Remove")}
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="required-course-actions">
          <button
            type="button"
            className="required-course-add"
            disabled={disabled || atLimit}
            onClick={addField}
          >
            <span aria-hidden="true">+</span> {t("Add another course")}
          </button>
          <button
            className="primary"
            type="submit"
            disabled={disabled || !terms.length}
          >
            {t(
              registered
                ? "Find registered courses in the catalog"
                : "Find required courses",
            )}
          </button>
        </div>
        <p className="hint" role="status">
          {t(
            atLimit
              ? "You can enter up to 8 courses at a time."
              : "Press Enter to move to the next course.",
          )}
        </p>
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

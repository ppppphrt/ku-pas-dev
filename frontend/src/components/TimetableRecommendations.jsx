import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../hooks/useLanguage";
import { recommendTimetables } from "../utils/recommendTimetable";

export default function TimetableRecommendations({
  results,
  timetable,
  busy,
  target,
  competencies,
}) {
  const { t, courseText } = useLanguage();
  const [excluded, setExcluded] = useState([]);
  const [savedPlan, setSavedPlan] = useState("");
  const plans = useMemo(
    () =>
      recommendTimetables(
        results.filter(({ course }) => !excluded.includes(course.subject_code)),
        timetable.items,
        timetable.metadata.max_credits,
        target,
      ),
    [
      results,
      excluded,
      timetable.items,
      timetable.metadata.max_credits,
      target,
    ],
  );

  return (
    <section className="selected" aria-label={t("Suggested timetables")}>
      <h3>{t("Suggested timetables")}</h3>
      <p>
        {t(
          "Choose the courses you would like to include. Plans respect your existing timetable and the planning credit limit.",
        )}
      </p>
      <fieldset>
        <legend>{t("Courses to consider")}</legend>
        {results.map(({ course }) => (
          <label key={course.subject_code} style={{ display: "block" }}>
            <input
              type="checkbox"
              checked={!excluded.includes(course.subject_code)}
              onChange={(event) =>
                setExcluded(
                  event.target.checked
                    ? excluded.filter((code) => code !== course.subject_code)
                    : [...excluded, course.subject_code],
                )
              }
            />{" "}
            {courseText(course, "name")} ({course.subject_code})
          </label>
        ))}
      </fieldset>
      {[
        [
          "time",
          "Timetable by availability",
          "Fits the days and times in your search and favors fewer class days and gaps.",
        ],
        [
          "competency",
          "Timetable by competency",
          "Prioritizes your selected competency, or broader competency coverage when none is selected.",
        ],
      ].map(([key, title, description]) => (
        <article key={key}>
          <h4>{t(title)}</h4>
          <p>{t(description)}</p>
          {key === "competency" && target && (
            <p>{t(competencies[target - 1])}</p>
          )}
          {plans[key].length ? (
            <>
              <ul>
                {plans[key].map(({ course, section, classification }) => (
                  <li key={course.subject_code}>
                    <strong>{courseText(course, "name")}</strong> (
                    {course.subject_code}) · {t("Section ")}
                    {section.section_code}
                    <br />
                    {section.time_slots
                      .map((slot) => `${t(slot.day)} ${slot.start}–${slot.end}`)
                      .join(" · ")}
                    {key === "competency" && (
                      <>
                        <br />
                        {classification.competencies
                          .map((id) => {
                            const label = t(competencies[id - 1]);
                            const weight =
                              classification.competency_weights?.[id];
                            return weight ? `${label} (${weight}%)` : label;
                          })
                          .join(", ")}
                        {classification.status === "mock" && (
                          <> · {t("Sample competency data")}</>
                        )}
                      </>
                    )}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                disabled={busy || timetable.busy || !timetable.ready}
                onClick={async () => {
                  setSavedPlan("");
                  if (await timetable.addPlan(plans[key])) setSavedPlan(key);
                }}
              >
                {t("Add this plan to my timetable")}
              </button>
            </>
          ) : (
            <p>
              {t(
                key === "time"
                  ? "No sections fit this plan."
                  : "No matching sections with competency data fit this plan.",
              )}
            </p>
          )}
          {savedPlan === key && (
            <p role="status">
              {t("Plan added.")}{" "}
              <Link to="/timetable">{t("Timetable Planner")}</Link>
            </p>
          )}
        </article>
      ))}
    </section>
  );
}

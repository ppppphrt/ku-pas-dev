import { useLanguage } from "../hooks/useLanguage";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTimetable } from "../hooks/useTimetable";
import { useAuth } from "../hooks/useAuth";
import { courseColor, creditState, DAYS, minutes } from "../utils/timetable";
import Modal from "../components/Modal";
export default function TimetablePage() {
  const [params] = useSearchParams();
  const { t, courseText } = useLanguage();
  const {
    items,
    metadata,
    busy,
    ready,
    error,
    remove,
    clear,
    importDemo,
    registration,
    registeredItems = [],
    conflictCodes = [],
  } = useTimetable();
  const { user, demoStudent } = useAuth();
  const [imported, setImported] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const { credits, count, status } = creditState(
    items,
    metadata.min_credits,
    metadata.max_credits,
  );
  const slots = items.flatMap((item) => item.section.time_slots);
  const startHour = Math.min(
    7,
    ...slots.map((slot) => Math.floor(minutes(slot.start) / 60)),
  );
  const endHour = Math.max(
    20,
    ...slots.map((slot) => Math.ceil(minutes(slot.end) / 60)),
  );
  const hours = Array.from(
    {
      length: endHour - startHour,
    },
    (_, index) => index + startHour,
  );
  return (
    <main id="main" className="container">
      <header className="planner-heading">
        <div>
          <p className="eyebrow">{t("Make room for what matters")}</p>
          <h1>{t("Timetable Planner")}</h1>
          <p>
            {registration ? (
              `KU-EDU · ${registration.academic_year} / ${registration.semester}`
            ) : (
              <>
                {t(metadata.data_source)}
                {t(" · Period unconfirmed")}
              </>
            )}
          </p>
        </div>
        <div className="credit-widget">
          <strong>
            {count}
            {t(" courses")}
          </strong>
          <strong>
            {registeredItems.length ? (
              t("Credits incomplete")
            ) : (
              <>
                {credits}
                {t(" credits")}
              </>
            )}
          </strong>
          <span>{t(status)}</span>
        </div>
      </header>
      <p>
        {metadata.min_credits}–{metadata.max_credits}
        {t(
          " credits: configurable planning range. Confirm your program rules.",
        )}
      </p>
      <p>
        {registeredItems.some((item) => !item.section.schedule_complete)
          ? t("Schedule incomplete")
          : items.length
            ? t("Conflict-free timetable")
            : t("No courses selected")}{" "}
        ·{" "}
        {registration
          ? t("KU-EDU timetable saved for this browser session")
          : user
            ? t("Saved to your account")
            : t("Saved in this browser")}
      </p>
      <p>
        <Link to="/enrollments">
          {t("Fetch my registered courses from KU-EDU")}
        </Link>
      </p>
      {registeredItems.some((item) => !item.section.schedule_complete) && (
        <p className="notice error" role="alert">
          {t(
            "Some registered schedules could not be read. Review the original times or remove these courses before finding GE.",
          )}
        </p>
      )}
      {registration && (
        <p>
          {t(
            "KU-EDU does not provide credits or section numbers. Registered times are used directly; catalog planning data may be from a different semester.",
          )}
        </p>
      )}
      {demoStudent && (
        <section aria-label={t("Sample timetable")}>
          <p>
            {t(
              "Preview a fictional Bangkhen student’s schedule using catalog sections.",
            )}
          </p>
          <button
            className="primary"
            disabled={busy || !ready}
            onClick={async () => {
              setImported(false);
              setImported(await importDemo());
            }}
          >
            {t("Import sample timetable")}
          </button>
          {imported && <p role="status">{t("Sample timetable is ready.")}</p>}
        </section>
      )}
      {ready && items.length > 0 && (
        <p>
          <Link className="button primary" to="/chat?ge=fit">
            {t("Use this timetable to find GE")}
          </Link>
        </p>
      )}
      {params.has("find-ge") && ready && !items.length && (
        <p>
          {t(
            "Add your registered courses and sections from Course Discovery, then return here to find GE.",
          )}
        </p>
      )}
      {!ready && !error && <p role="status">{t("Restoring timetable…")}</p>}
      {error && (
        <p role="alert" className="error">
          {t(error)}
        </p>
      )}
      <div className="planner-body">
        <aside className="selected">
          <h2>{t("Selected courses")}</h2>
          {!items.length && (
            <p>
              {t("Add a section from ")}
              <Link to="/courses">{t("Course Discovery")}</Link>.
            </p>
          )}
          {items.map(({ course, section, source, raw_schedules }) => (
            <article
              key={course.subject_code}
              style={{
                borderLeft: `6px solid ${courseColor(course.subject_code)}`,
              }}
            >
              <h3>
                <Link
                  to={`/courses/${encodeURIComponent(course.subject_code)}`}
                >
                  {courseText(course, "name")}
                </Link>
              </h3>
              <p>
                {course.subject_code}
                {source === "KU-EDU" ? (
                  " · KU-EDU"
                ) : (
                  <>
                    {t(" · Section ")}
                    {section.section_code} · {course.credits}
                    {t(" credits")}
                  </>
                )}
              </p>
              <ul>
                {section.time_slots.map((slot, i) => (
                  <li key={i}>
                    {t(slot.day)} {slot.start}–{slot.end}
                  </li>
                ))}
              </ul>
              {source === "KU-EDU" && !section.schedule_complete && (
                <p>{raw_schedules.join(", ") || t("Not provided")}</p>
              )}
              <button
                disabled={busy}
                onClick={() => remove(course.subject_code)}
              >
                {t("Remove ")}
                {course.subject_code}
              </button>
            </article>
          ))}
          <button
            disabled={busy || (ready && !items.length)}
            onClick={() => setConfirm(true)}
          >
            {t("Clear timetable")}
          </button>
        </aside>
        <section className="week-wrap" aria-label={t("Weekly timetable")}>
          <div className="week">
            <div className="time-axis">
              <div className="day-header">{t("Time")}</div>
              {hours.map((h) => (
                <div
                  className="hour"
                  key={h}
                >{`${String(h).padStart(2, "0")}:00`}</div>
              ))}
            </div>
            {DAYS.map((day) => (
              <div key={day}>
                <div className="day-header">{t(day)}</div>
                <div
                  className="day-column"
                  style={{
                    height: (endHour - startHour) * 48,
                  }}
                >
                  {items.flatMap(({ course, section, source }) =>
                    section.time_slots
                      .filter((s) => s.day === day)
                      .map((slot, i) => (
                        <div
                          key={`${section.section_id}-${i}`}
                          className={`course-block ${conflictCodes.includes(course.subject_code) ? "conflicting" : ""}`}
                          style={{
                            top: (minutes(slot.start) - startHour * 60) * 0.8,
                            height:
                              (minutes(slot.end) - minutes(slot.start)) * 0.8,
                            background: courseColor(course.subject_code),
                          }}
                          title={`${courseText(course, "name")}: ${slot.start}–${slot.end}`}
                        >
                          <strong>{course.subject_code}</strong>
                          <span>
                            {slot.start}–{slot.end}
                          </span>
                          <span>{courseText(course, "name")}</span>
                          <span>
                            {source === "KU-EDU" ? (
                              "KU-EDU"
                            ) : (
                              <>
                                {t("Section ")}
                                {section.section_code}
                              </>
                            )}
                          </span>
                        </div>
                      )),
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
      {confirm && (
        <Modal title={t("Clear timetable?")} onClose={() => setConfirm(false)}>
          <p>
            {t(
              "This removes every selected section from this saved timetable.",
            )}
          </p>
          <button
            className="danger"
            disabled={busy}
            onClick={async () => {
              if (await clear()) setConfirm(false);
            }}
          >
            {t("Clear all sections")}
          </button>
        </Modal>
      )}
    </main>
  );
}

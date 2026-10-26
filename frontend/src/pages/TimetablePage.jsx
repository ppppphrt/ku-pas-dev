import { useLanguage } from "../hooks/useLanguage";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useTimetable } from "../hooks/useTimetable";
import { useAuth } from "../hooks/useAuth";
import { courseColor, creditState, DAYS, minutes } from "../utils/timetable";
import Modal from "../components/Modal";
export default function TimetablePage() {
  const { t, courseText } = useLanguage();
  const {
    items,
    metadata,
    busy,
    ready,
    error,
    remove,
    clear,
    conflictCodes = [],
  } = useTimetable();
  const { user } = useAuth();
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
            {t(metadata.data_source)}
            {t(" · Period unconfirmed")}
          </p>
        </div>
        <div className="credit-widget">
          <strong>
            {count}
            {t(" courses")}
          </strong>
          <strong>
            {credits}
            {t(" credits")}
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
        {items.length ? t("Conflict-free timetable") : t("No courses selected")}{" "}
        · {user ? t("Saved to your account") : t("Saved in this browser")}
      </p>
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
              <Link to="/">{t("Course Discovery")}</Link>.
            </p>
          )}
          {items.map(({ course, section }) => (
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
                {t(" · Section ")}
                {section.section_code} · {course.credits}
                {t(" credits")}
              </p>
              <ul>
                {section.time_slots.map((slot, i) => (
                  <li key={i}>
                    {t(slot.day)} {slot.start}–{slot.end}
                  </li>
                ))}
              </ul>
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
                  {items.flatMap(({ course, section }) =>
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
                            {t("Section ")}
                            {section.section_code}
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

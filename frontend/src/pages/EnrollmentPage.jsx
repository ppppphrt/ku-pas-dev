import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../hooks/useLanguage";
import { api, errorMessage } from "../services/courseApi";
import "./EnrollmentPage.css";

export default function EnrollmentPage({ metadata }) {
  const { t } = useLanguage();
  const [key, setKey] = useState("");
  const [year, setYear] = useState("");
  const [semester, setSemester] = useState("1");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(null);
  useEffect(() => () => pending.current?.abort(), []);
  function reset() {
    pending.current?.abort();
    pending.current = null;
    setBusy(false);
    setResult(null);
    setError("");
  }
  async function lookup(event) {
    event.preventDefault();
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const { data } = await api.post(
        "/enrollments/semester",
        { academic_year: Number(year), semester: Number(semester) },
        {
          headers: { "X-Enrollment-Key": key.trim() },
          signal: controller.signal,
        },
      );
      if (!controller.signal.aborted) setResult(data);
    } catch (e) {
      if (!controller.signal.aborted) setError(t(errorMessage(e)));
    } finally {
      if (pending.current === controller) {
        pending.current = null;
        setBusy(false);
      }
    }
  }
  return (
    <main id="main" className="container enrollment-page">
      <p className="eyebrow">KU-EDU</p>
      <h1>{t("My registered courses")}</h1>
      <p>
        {t(
          "Use the private access code issued to you for the pilot. Each code can retrieve only its assigned student's courses.",
        )}
      </p>
      {!metadata.enrollment_enabled ? (
        <p role="status">{t("Enrollment lookup is not configured.")}</p>
      ) : (
        <form className="panel enrollment-form" onSubmit={lookup}>
          <label>
            {t("Student access code")}
            <input
              type="password"
              autoComplete="off"
              required
              minLength={32}
              maxLength={256}
              value={key}
              onChange={(e) => {
                reset();
                setKey(e.target.value);
              }}
            />
          </label>
          <label>
            {t("Academic year (B.E.)")}
            <input
              type="number"
              required
              min="2500"
              max="2700"
              step="1"
              placeholder="2568"
              value={year}
              onChange={(e) => {
                reset();
                setYear(e.target.value);
              }}
            />
          </label>
          <label>
            {t("Semester")}
            <select
              value={semester}
              onChange={(e) => {
                reset();
                setSemester(e.target.value);
              }}
            >
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
            </select>
          </label>
          <button className="primary" disabled={busy || !key.trim() || !year}>
            {t(
              busy ? "Loading registered courses…" : "Fetch registered courses",
            )}
          </button>
        </form>
      )}
      <p>
        {t(
          "The access code and retrieved courses are kept only on this page. Clear them when finished, especially on a shared device.",
        )}
      </p>
      {(key || result) && (
        <button
          type="button"
          onClick={() => {
            reset();
            setKey("");
          }}
        >
          {t("Clear private data")}
        </button>
      )}
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {busy && <p role="status">{t("Loading registered courses…")}</p>}
      {result && (
        <section aria-label={t("Registered course results")} aria-live="polite">
          <h2>
            {result.academic_year} / {result.semester} · {result.courses.length}{" "}
            {t("courses")}
          </h2>
          <p>
            {t(
              "Source: KU-EDU registration API. Status codes are shown exactly as returned.",
            )}
          </p>
          {!result.courses.length && (
            <p role="status">
              {t(
                "No enrollment records found for this academic year and semester. Check the B.E. year and semester.",
              )}
            </p>
          )}
          <div className="enrollment-courses">
            {result.courses.map((course, i) => (
              <article className="panel" key={`${course.subject_code}-${i}`}>
                <p className="eyebrow">{course.subject_code}</p>
                <h3>{course.subject_name}</h3>
                <p>
                  {t("Enrollment status")}:{" "}
                  <strong>{course.enroll_status}</strong>
                </p>
                <p>
                  {t("Instructors")}:{" "}
                  {[
                    ...new Set(
                      course.instrs.map((instructor) =>
                        `${instructor.first_name} ${instructor.last_name}`.trim(),
                      ),
                    ),
                  ].join(", ") || t("Not provided")}
                </p>
                <h4>{t("Class schedules")}</h4>
                {course.schedules.length ? (
                  <ul>
                    {course.schedules.map((schedule, j) => (
                      <li key={j}>{schedule}</li>
                    ))}
                  </ul>
                ) : (
                  <p>{t("Not provided")}</p>
                )}
              </article>
            ))}
          </div>
          {result.courses.length > 0 && (
            <p>
              {t(
                "These are your registration records. To plan GE with the existing planner, select and verify the matching catalog sections and times first; this snapshot may differ from your actual semester.",
              )}
            </p>
          )}
        </section>
      )}
      <p>
        <Link to="/timetable">{t("Timetable Planner")}</Link> ·{" "}
        <Link to="/">{t("Back to choices")}</Link>
      </p>
    </main>
  );
}

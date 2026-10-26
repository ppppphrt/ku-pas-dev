import { useLanguage } from "../hooks/useLanguage";
import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { getCourse, errorMessage } from "../services/courseApi";
import { useTimetable } from "../hooks/useTimetable";
import { Badge, EmptyState, Loading } from "../components/ui";
export default function CourseDetailPage() {
  const { subjectCode } = useParams();
  return <Details key={subjectCode} code={subjectCode} />;
}
function Details({ code }) {
  const { t, courseText } = useLanguage();
  const location = useLocation();
  const [course, setCourse] = useState(null);
  const [selected, setSelected] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [retry, setRetry] = useState(0);
  const timetable = useTimetable();
  useEffect(() => {
    const controller = new AbortController();
    getCourse(code, controller.signal)
      .then(setCourse)
      .catch((e) => {
        if (e.code !== "ERR_CANCELED") setError(errorMessage(e));
      });
    return () => controller.abort();
  }, [code, retry]);
  const added = timetable.items.some(
    (item) => item.course.subject_code === code,
  );
  const section = course?.sections.find((s) => s.section_id === selected);
  return (
    <main id="main" className="container detail">
      <Link to={`/${location.state?.from || ""}`}>
        {t("← Back to results")}
      </Link>
      {error ? (
        <div className="error" role="alert">
          {t(error)}
          <button
            onClick={() => {
              setError("");
              setRetry((n) => n + 1);
            }}
          >
            {t("Retry")}
          </button>
        </div>
      ) : !course ? (
        <Loading />
      ) : (
        <>
          <Badge>{course.subject_code}</Badge>
          <h1>{courseText(course, "name")}</h1>
          <p lang="th">
            {course.subject_name_th !== courseText(course, "name")
              ? course.subject_name_th
              : null}
          </p>
          <div className="badges">
            <Badge>
              {course.credits ?? t("Unknown")}
              {t(" credits")}
            </Badge>
            <Badge>{t(course.faculty) || t("Faculty unavailable")}</Badge>
            <Badge>{t(course.campus) || t("Campus unavailable")}</Badge>
          </div>
          <h2>{t("Description")}</h2>
          <p>
            {courseText(course, "description") ||
              t("No description available.")}
          </p>
          <p lang="th">
            {course.subject_desc_th !== courseText(course, "description")
              ? course.subject_desc_th
              : null}
          </p>
          <dl>
            <dt>{t("Department")}</dt>
            <dd>{course.department || t("Not provided")}</dd>
            <dt>{t("Prerequisites")}</dt>
            <dd>
              {course.prerequisites || t("Not provided; check your curriculum")}
            </dd>
          </dl>
          <h2>{t("Choose a section")}</h2>
          {!course.sections.length ? (
            <EmptyState>
              {t("No sections in the supplied snapshot.")}
            </EmptyState>
          ) : (
            <fieldset className="section-list">
              <legend>{t("Available sections")}</legend>
              {course.sections.map((s) => (
                <label className="section-option" key={s.section_id}>
                  <input
                    type="radio"
                    name="section"
                    value={s.section_id}
                    checked={selected === s.section_id}
                    disabled={!s.schedule_complete || course.credits == null}
                    onChange={() => setSelected(s.section_id)}
                  />
                  <span>
                    <strong>
                      {t("Section ")}
                      {s.section_code}
                    </strong>{" "}
                    · {t(s.faculty)} · {t(s.campus)}
                    <br />
                    {s.time_slots.map((slot, i) => (
                      <span className="slot" key={i}>
                        {t(slot.day)} {slot.start}–{slot.end} ·{" "}
                        {slot.location || t("Room not provided")}
                      </span>
                    ))}
                    {!s.schedule_complete && (
                      <span className="warning">{t(s.schedule_note)}</span>
                    )}
                    <span className="hint">
                      {t("Registered ")}
                      {s.total_registered ?? "?"} / {s.total_seat ?? "?"}
                      {t(" seats (snapshot)")}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>
          )}
          <button
            className="primary"
            disabled={!section || added || !timetable.ready || timetable.busy}
            onClick={async () => {
              if (await timetable.add(course, section))
                setMessage("Section added to your timetable.");
            }}
          >
            {added
              ? t("Already added")
              : timetable.busy
                ? t("Checking timetable…")
                : t("Add selected section")}
          </button>
          <p role="status">{t(message)}</p>
          <Link to="/timetable">{t("View timetable")}</Link>
        </>
      )}
    </main>
  );
}

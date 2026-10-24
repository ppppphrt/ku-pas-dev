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
      <Link to={`/${location.state?.from || ""}`}>← Back to results</Link>
      {error ? (
        <div className="error" role="alert">
          {error}
          <button
            onClick={() => {
              setError("");
              setRetry((n) => n + 1);
            }}
          >
            Retry
          </button>
        </div>
      ) : !course ? (
        <Loading />
      ) : (
        <>
          <Badge>{course.subject_code}</Badge>
          <h1>{course.subject_name_en || course.subject_name_th}</h1>
          <p lang="th">{course.subject_name_th}</p>
          <div className="badges">
            <Badge>{course.credits ?? "Unknown"} credits</Badge>
            <Badge>{course.faculty || "Faculty unavailable"}</Badge>
            <Badge>{course.campus || "Campus unavailable"}</Badge>
          </div>
          <h2>Description</h2>
          <p>{course.subject_desc_en || "English description unavailable."}</p>
          <p lang="th">{course.subject_desc_th}</p>
          <dl>
            <dt>Department</dt>
            <dd>{course.department || "Not provided"}</dd>
            <dt>Prerequisites</dt>
            <dd>
              {course.prerequisites || "Not provided; check your curriculum"}
            </dd>
          </dl>
          <h2>Choose a section</h2>
          {!course.sections.length ? (
            <EmptyState>No sections in the supplied snapshot.</EmptyState>
          ) : (
            <fieldset className="section-list">
              <legend>Available sections</legend>
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
                    <strong>Section {s.section_code}</strong> · {s.faculty} ·{" "}
                    {s.campus}
                    <br />
                    {s.time_slots.map((slot, i) => (
                      <span className="slot" key={i}>
                        {slot.day} {slot.start}–{slot.end} ·{" "}
                        {slot.location || "Room not provided"}
                      </span>
                    ))}
                    {!s.schedule_complete && (
                      <span className="warning">{s.schedule_note}</span>
                    )}
                    <span className="hint">
                      Registered {s.total_registered ?? "?"} /{" "}
                      {s.total_seat ?? "?"} seats (snapshot)
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
              ? "Already added"
              : timetable.busy
                ? "Checking timetable…"
                : "Add selected section"}
          </button>
          <p role="status">{message}</p>
          <Link to="/timetable">View timetable</Link>
        </>
      )}
    </main>
  );
}

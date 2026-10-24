import { Link } from "react-router-dom";
import { Badge } from "./ui";
import { useTimetable } from "../hooks/useTimetable";
function Highlight({ text, query }) {
  const start = query
    ? text.toLocaleLowerCase().indexOf(query.toLocaleLowerCase())
    : -1;
  return start < 0 ? (
    text
  ) : (
    <>
      {text.slice(0, start)}
      <mark>{text.slice(start, start + query.length)}</mark>
      {text.slice(start + query.length)}
    </>
  );
}
export default function CourseCard({ course, mode, query }) {
  const { items } = useTimetable();
  const added = items.some(
    (item) => item.course.subject_code === course.subject_code,
  );
  const detailUrl = `/courses/${encodeURIComponent(course.subject_code)}`;
  return (
    <article className="course-card">
      <div className="course-heading">
        <Badge>{course.subject_code}</Badge>
        {added && <Badge>Already added</Badge>}
      </div>
      <h2>
        <Link to={detailUrl} state={{ from: window.location.search }}>
          <Highlight
            text={course.subject_name_en || course.subject_name_th}
            query={mode === "search" ? query : ""}
          />
        </Link>
      </h2>
      <p lang="th">{course.subject_name_th}</p>
      <div className="badges">
        <Badge>{course.credits ?? "Unknown"} credits</Badge>
        <Badge>{course.faculty || "Faculty unavailable"}</Badge>
        <Badge>{course.sections.length} sections</Badge>
        {mode === "ask" && course.similarity_score != null && (
          <Badge>{Math.round(course.similarity_score * 100)}% similarity</Badge>
        )}
      </div>
      <p className="description">
        {course.subject_desc_en ||
          course.subject_desc_th ||
          "No description available."}
      </p>
      <Link
        className="button"
        to={detailUrl}
        state={{ from: window.location.search }}
      >
        {added ? "View selected course" : "Details and section selection"}
      </Link>
    </article>
  );
}

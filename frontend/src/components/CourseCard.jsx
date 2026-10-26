import Icon from "./Icon";
import { useLanguage } from "../hooks/useLanguage";
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
  const { t, courseText } = useLanguage();
  const { items } = useTimetable();
  const added = items.some(
    (item) => item.course.subject_code === course.subject_code,
  );
  const detailUrl = `/courses/${encodeURIComponent(course.subject_code)}`;
  return (
    <article className="course-card">
      <div className="course-heading">
        <span className="course-symbol">
          <Icon name="book" />
        </span>
        <Badge>{course.subject_code}</Badge>
        {added && <Badge>{t("Already added")}</Badge>}
      </div>
      <h2>
        <Link
          to={detailUrl}
          state={{
            from: window.location.search,
          }}
        >
          <Highlight
            text={courseText(course, "name")}
            query={mode === "search" ? query : ""}
          />
        </Link>
      </h2>
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
        <Badge>
          {course.sections.length}
          {t(" sections")}
        </Badge>
        {mode === "ask" && course.similarity_score != null && (
          <Badge>
            {Math.round(course.similarity_score * 100)}
            {t("% similarity")}
          </Badge>
        )}
      </div>
      <p className="description">
        {courseText(course, "description") || t("No description available.")}
      </p>
      <Link
        className="button"
        to={detailUrl}
        state={{
          from: window.location.search,
        }}
      >
        {added ? t("View selected course") : t("Details and section selection")}
        <Icon name="arrow" />
      </Link>
    </article>
  );
}

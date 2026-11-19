import { Link } from "react-router-dom";
import { useLanguage } from "../hooks/useLanguage";
import Icon from "./Icon";
import "./PlanningHome.css";

export default function PlanningHome({ onPlan }) {
  const { t, language } = useLanguage();
  return (
    <main id="main" className="planning-home" lang={language}>
      <section className="planning-hero" aria-labelledby="planning-title">
        <div>
          <p className="planning-kicker">
            <Icon name="book" /> KU-PAS · {t("Bangkhen")}
          </p>
          <h1 id="planning-title">{t("Find GE that fits your timetable")}</h1>
          <p>
            {t(
              "Plan your required courses first, or use the timetable you already have to find GE courses that fit.",
            )}
          </p>
        </div>
        <div className="planning-preview" aria-hidden="true">
          <div className="planning-preview-heading">
            <Icon name="calendar" /> {t("Weekly timetable")}
          </div>
          <div className="planning-preview-grid">
            {[0, 1, 2, 3, 4].map((column) => (
              <span key={column} />
            ))}
            <i className="planning-slot slot-one" />
            <i className="planning-slot slot-two" />
            <i className="planning-slot slot-three" />
            <i className="planning-slot slot-ge">GE</i>
          </div>
        </div>
      </section>
      <section className="planning-choices" aria-labelledby="entry-title">
        <h2 id="entry-title">{t("How would you like to start?")}</h2>
        <div className="planning-paths">
          <button className="planning-path" type="button" onClick={onPlan}>
            <span className="planning-path-icon">
              <Icon name="calendar" />
            </span>
            <span className="planning-path-copy">
              <strong>{t("Not registered yet")}</strong>
              <span>
                {t(
                  "Enter your required courses and let KU-PAS arrange the sections.",
                )}
              </span>
              <span className="planning-action">
                {t("Plan required courses")} <Icon name="arrow" />
              </span>
            </span>
          </button>
          <Link className="planning-path" to="/timetable?find-ge=1">
            <span className="planning-path-icon existing">
              <Icon name="search" />
            </span>
            <span className="planning-path-copy">
              <strong>{t("Already registered")}</strong>
              <span>
                {t(
                  "Use the sections you already have to find GE without time conflicts.",
                )}
              </span>
              <span className="planning-action">
                {t("Find GE to add")} <Icon name="arrow" />
              </span>
            </span>
          </Link>
        </div>
        <Link className="planning-browse" to="/chat?ge=browse">
          {t("Browse GE courses first")} <Icon name="arrow" />
        </Link>
        <Link className="planning-browse" to="/enrollments">
          {t("My registered courses")} <Icon name="arrow" />
        </Link>
      </section>
    </main>
  );
}

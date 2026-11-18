import { DEMO_MODE } from "../services/courseApi";
import Icon from "./Icon";
import { useLanguage } from "../hooks/useLanguage";
import { NavLink, Link, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
export default function TopBar() {
  const { t, language, setLanguage } = useLanguage();
  const { user, logout, demoStudent, signOutDemo } = useAuth();
  const location = useLocation();
  const discovery = `/courses${location.pathname === "/courses" ? location.search : sessionStorage.getItem("ku-discovery-query") || ""}`;
  return (
    <>
      <a className="skip-link" href="#main">
        {t("Skip to main content")}
      </a>
      <nav className="top-bar" aria-label={t("Main navigation")}>
        <Link className="logo" to="/">
          <span className="logo-mark">
            <Icon name="book" />
          </span>{" "}
          KU-PAS
        </Link>
        <div className="nav-links">
          <NavLink
            to="/"
            end
            className={location.pathname === "/chat" ? "active" : undefined}
          >
            <Icon name="chat" />
            {t("GE Chat")}
          </NavLink>
          <NavLink to={discovery} end>
            <Icon name="search" />
            {t("Course Discovery")}
          </NavLink>
          <NavLink to="/timetable">
            <Icon name="calendar" />
            {t("Timetable Planner")}
          </NavLink>
        </div>
        <div
          className="language-switch"
          role="group"
          aria-label="Language / ภาษา"
        >
          <button
            type="button"
            lang="th"
            aria-pressed={language === "th"}
            onClick={() => setLanguage("th")}
          >
            ไทย
          </button>
          <button
            type="button"
            lang="en"
            aria-pressed={language === "en"}
            onClick={() => setLanguage("en")}
          >
            English
          </button>
        </div>
        <span className="account">
          {DEMO_MODE ? (
            demoStudent ? (
              <>
                <span>{t("Demo student")}</span>
                <button onClick={signOutDemo}>{t("Sign out")}</button>
              </>
            ) : (
              <Link to="/login">{t("Try demo student")}</Link>
            )
          ) : user ? (
            <>
              <span>{user.username}</span>
              <button onClick={logout}>{t("Sign out")}</button>
            </>
          ) : (
            <Link to="/login">{t("Sign in")}</Link>
          )}
        </span>
      </nav>
    </>
  );
}

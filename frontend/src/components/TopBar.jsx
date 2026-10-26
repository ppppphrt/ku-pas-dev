import { useLanguage } from "../hooks/useLanguage";
import { NavLink, Link, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
export default function TopBar() {
  const { t, language, setLanguage } = useLanguage();
  const { user, logout } = useAuth();
  const location = useLocation();
  const discovery = `/${location.pathname === "/" ? location.search : sessionStorage.getItem("ku-discovery-query") || ""}`;
  return (
    <>
      <a className="skip-link" href="#main">
        {t("Skip to main content")}
      </a>
      <nav className="top-bar" aria-label={t("Main navigation")}>
        <Link className="logo" to="/">
          KU-PAS
        </Link>
        <NavLink to={discovery} end>
          {t("Course Discovery")}
        </NavLink>
        <NavLink to="/timetable">{t("Timetable Planner")}</NavLink>
        <NavLink to="/chat">{t("GE Chat")}</NavLink>
        <label className="language-picker">
          <span>Language / ภาษา</span>
          <select
            aria-label="Language / ภาษา"
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
          >
            <option value="en" lang="en">
              English
            </option>
            <option value="th" lang="th">
              ภาษาไทย
            </option>
          </select>
        </label>
        <span className="account">
          {user ? (
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

import { NavLink, Link, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
export default function TopBar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const discovery = `/${location.pathname === "/" ? location.search : sessionStorage.getItem("ku-discovery-query") || ""}`;
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      <nav className="top-bar" aria-label="Main navigation">
        <Link className="logo" to="/">
          KU-PAS
        </Link>
        <NavLink to={discovery} end>
          Course Discovery
        </NavLink>
        <NavLink to="/timetable">Timetable Planner</NavLink>
        <NavLink to="/chat">GE Chat</NavLink>
        <span className="account">
          {user ? (
            <>
              <span>{user.username}</span>
              <button onClick={logout}>Sign out</button>
            </>
          ) : (
            <Link to="/login">Sign in</Link>
          )}
        </span>
      </nav>
    </>
  );
}

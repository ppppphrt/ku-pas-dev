import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { errorMessage } from "../services/courseApi";
export default function AccountPage({ register = false }) {
  const { authenticate } = useAuth();
  const navigate = useNavigate();
  const [values, setValues] = useState({
    username: "",
    email: "",
    password: "",
    confirm: "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  function field(key, label, type = "text") {
    return (
      <label>
        {label}
        <input
          type={type}
          value={values[key]}
          autoComplete={
            key === "password"
              ? register
                ? "new-password"
                : "current-password"
              : key === "confirm"
                ? "new-password"
                : key
          }
          minLength={
            key === "password" || key === "confirm"
              ? 10
              : key === "username"
                ? 3
                : undefined
          }
          maxLength={
            key === "password" || key === "confirm"
              ? 128
              : key === "username"
                ? 60
                : 254
          }
          pattern={key === "username" ? "[a-zA-Z0-9_.-]+" : undefined}
          required
          onChange={(e) => setValues({ ...values, [key]: e.target.value })}
        />
      </label>
    );
  }
  async function submit(event) {
    event.preventDefault();
    if (register && values.password !== values.confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const body = { username: values.username, password: values.password };
      if (register) body.email = values.email;
      await authenticate(register ? "register" : "login", body);
      navigate("/timetable");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main id="main" className="account-page">
      <form className="account-card" onSubmit={submit}>
        <h1>{register ? "Create account" : "Sign in"}</h1>
        <p>Save a timetable to your local account.</p>
        {field("username", "Username")}
        {register && field("email", "Email", "email")}
        {field("password", "Password (at least 10 characters)", "password")}
        {register && field("confirm", "Confirm password", "password")}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="primary" disabled={busy}>
          {busy ? "Please wait…" : register ? "Create account" : "Sign in"}
        </button>
        <Link to={register ? "/login" : "/register"}>
          {register ? "Already registered? Sign in" : "Create a new account"}
        </Link>
        <Link to="/">Continue as guest</Link>
        <p className="hint">
          Guest and account timetables are kept separately.
        </p>
      </form>
    </main>
  );
}

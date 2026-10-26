import { useLanguage } from "../hooks/useLanguage";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { errorMessage, DEMO_MODE } from "../services/courseApi";
export default function AccountPage({ register = false }) {
  const { t } = useLanguage();
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
        {t(label)}
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
          onChange={(e) =>
            setValues({
              ...values,
              [key]: e.target.value,
            })
          }
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
      const body = {
        username: values.username,
        password: values.password,
      };
      if (register) body.email = values.email;
      await authenticate(register ? "register" : "login", body);
      navigate("/timetable");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  if (DEMO_MODE)
    return (
      <main id="main" className="account-page">
        <div className="account-card">
          <h1>{t("Guest demo")}</h1>
          <p>
            {t(
              "Demo timetables are saved in this browser. Accounts are unavailable.",
            )}
          </p>
          <Link className="button primary" to="/">
            {t("Continue as guest")}
          </Link>
        </div>
      </main>
    );
  return (
    <main id="main" className="account-page">
      <form className="account-card" onSubmit={submit}>
        <h1>{register ? t("Create account") : t("Sign in")}</h1>
        <p>{t("Save a timetable to your local account.")}</p>
        {field("username", "Username")}
        {register && field("email", "Email", "email")}
        {field("password", "Password (at least 10 characters)", "password")}
        {register && field("confirm", "Confirm password", "password")}
        {error && (
          <p className="error" role="alert">
            {t(error)}
          </p>
        )}
        <button className="primary" disabled={busy}>
          {busy
            ? t("Please wait…")
            : register
              ? t("Create account")
              : t("Sign in")}
        </button>
        <Link to={register ? "/login" : "/register"}>
          {register
            ? t("Already registered? Sign in")
            : t("Create a new account")}
        </Link>
        <Link to="/">{t("Continue as guest")}</Link>
        <p className="hint">
          {t("Guest and account timetables are kept separately.")}
        </p>
      </form>
    </main>
  );
}

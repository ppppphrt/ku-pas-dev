import { LanguageProvider } from "./context/LanguageContext";
import { useLanguage } from "./hooks/useLanguage";
import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { TimetableProvider } from "./context/TimetableContext";
import { useAuth } from "./hooks/useAuth";
import { useTimetable } from "./hooks/useTimetable";
import { api, errorMessage, DEMO_MODE } from "./services/courseApi";
import ErrorBoundary from "./components/ErrorBoundary";
import TopBar from "./components/TopBar";
import { Loading } from "./components/ui";
import CoursePage from "./pages/CoursePage";
import ChatPage from "./pages/ChatPage";
import CourseDetailPage from "./pages/CourseDetailPage";
import TimetablePage from "./pages/TimetablePage";
import AccountPage from "./pages/AccountPage";
import NotFoundPage from "./pages/NotFoundPage";
import "./App.css";
import "./new-ui.css";
function TimetableNotice() {
  const { t } = useLanguage();
  const { error } = useTimetable();
  return (
    error && (
      <div className="notice error" role="alert">
        {t(error)}{" "}
        <Link to="/timetable">{t("Review or clear saved timetable")}</Link>
      </div>
    )
  );
}
function Workspace() {
  const { t } = useLanguage();
  const { ready, user, notice } = useAuth();
  const [metadata, setMetadata] = useState(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    api
      .get("/metadata", {
        signal: controller.signal,
      })
      .then(({ data }) => setMetadata(data))
      .catch((e) => {
        if (e.code !== "ERR_CANCELED") setError(errorMessage(e));
      });
    return () => controller.abort();
  }, [retry]);
  if (!ready) return <Loading text={t("Checking your session…")} />;
  return (
    <>
      <TopBar />
      {notice && (
        <p className="notice" role="status">
          {t(notice)}
        </p>
      )}
      {error ? (
        <main id="main" className="container error" role="alert">
          <h1>{t("Unable to load the catalog")}</h1>
          <p>{t(error)}</p>
          <button
            onClick={() => {
              setError("");
              setRetry((n) => n + 1);
            }}
          >
            {t("Retry connection")}
          </button>
        </main>
      ) : !metadata ? (
        <main id="main">
          <Loading text={t("Loading the course catalog…")} />
        </main>
      ) : (
        <>
          {DEMO_MODE && (
            <div className="notice" role="status">
              {t(
                "Demo timetables are saved in this browser. Accounts are unavailable.",
              )}
            </div>
          )}
          <div className="notice dataset-notice">
            {t(
              "KU Drive course snapshot. Academic year and semester are unconfirmed. Sections with missing or invalid schedules cannot be added.",
            )}
          </div>
          <TimetableProvider
            key={`${metadata.dataset_version}:${user?.id || "guest"}`}
            metadata={metadata}
          >
            <TimetableNotice />
            <Routes>
              <Route path="/" element={<CoursePage metadata={metadata} />} />
              <Route path="/chat" element={<ChatPage />} />
              <Route
                path="/courses/:subjectCode"
                element={<CourseDetailPage />}
              />
              <Route path="/timetable" element={<TimetablePage />} />
              <Route path="/login" element={<AccountPage key="login" />} />
              <Route
                path="/register"
                element={<AccountPage key="register" register />}
              />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </TimetableProvider>
        </>
      )}
    </>
  );
}
export default function App() {
  return (
    <LanguageProvider>
      <ErrorBoundary>
        <AuthProvider>
          <BrowserRouter>
            <Workspace />
          </BrowserRouter>
        </AuthProvider>
      </ErrorBoundary>
    </LanguageProvider>
  );
}

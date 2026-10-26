import { Component } from "react";
import { useLanguage } from "../hooks/useLanguage";
function ErrorFallback() {
  const { t } = useLanguage();
  return (
    <main className="container">
      <h1>{t("Something went wrong")}</h1>
      <p>{t("Reload the page to try again. Your saved timetable is kept.")}</p>
      <button onClick={() => window.location.reload()}>{t("Reload")}</button>
    </main>
  );
}
export default class ErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <ErrorFallback /> : this.props.children;
  }
}

import { useLanguage } from "../hooks/useLanguage";
import { Link } from "react-router-dom";
export default function NotFoundPage() {
  const { t } = useLanguage();
  return (
    <main id="main" className="container">
      <h1>{t("Page not found")}</h1>
      <p>{t("That page is unavailable.")}</p>
      <Link to="/">{t("Return to Course Discovery")}</Link>
    </main>
  );
}

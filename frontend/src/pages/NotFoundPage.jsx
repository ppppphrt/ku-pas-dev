import { Link } from "react-router-dom";
export default function NotFoundPage() {
  return (
    <main id="main" className="container">
      <h1>Page not found</h1>
      <p>That page is unavailable.</p>
      <Link to="/">Return to Course Discovery</Link>
    </main>
  );
}

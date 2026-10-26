import { useLanguage } from "../hooks/useLanguage";
export function Button({ children, variant = "", ...props }) {
  return (
    <button className={`button ${variant}`} {...props}>
      {children}
    </button>
  );
}
export function Badge({ children }) {
  return <span className="badge">{children}</span>;
}
export function Loading({ text = "Loading…" }) {
  const { t } = useLanguage();
  return (
    <div role="status" className="loading">
      <span className="skeleton" />
      {t(text)}
    </div>
  );
}
export function EmptyState({ children }) {
  return <div className="empty">{children}</div>;
}

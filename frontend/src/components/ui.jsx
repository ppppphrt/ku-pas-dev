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
  return (
    <div role="status" className="loading">
      <span className="skeleton" />
      {text}
    </div>
  );
}
export function EmptyState({ children }) {
  return <div className="empty">{children}</div>;
}

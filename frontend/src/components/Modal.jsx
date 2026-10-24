import { useEffect, useRef } from "react";

export default function Modal({ title, children, onClose }) {
  const ref = useRef(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement;
    dialog.showModal();
    const cancel = (event) => {
      event.preventDefault();
      close.current();
    };
    dialog.addEventListener("cancel", cancel);
    return () => {
      dialog.removeEventListener("cancel", cancel);
      dialog.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog ref={ref} aria-labelledby="dialog-title">
      <h2 id="dialog-title">{title}</h2>
      {children}
      <button onClick={onClose}>Close</button>
    </dialog>
  );
}

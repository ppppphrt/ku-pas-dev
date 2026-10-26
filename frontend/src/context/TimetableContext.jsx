import { useLanguage } from "../hooks/useLanguage";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { TimetableContext } from "./timetable";
import { api, errorMessage, validateTimetable } from "../services/courseApi";
import { loadGuest, refs } from "../utils/timetable";
import Modal from "../components/Modal";
export function TimetableProvider({ metadata, children }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [state, setState] = useState({
    items: [],
    error: "",
    ready: false,
  });
  const [busy, setBusy] = useState(false);
  const [conflicts, setConflicts] = useState(null);
  const version = metadata.dataset_version;
  const pending = useRef(false);
  useEffect(() => {
    let active = true;
    async function restore() {
      try {
        const saved = user
          ? (await api.get("/timetable")).data
          : loadGuest(localStorage, version);
        const response = user
          ? saved
          : await validateTimetable({
              dataset_version: version,
              items: saved.items || [],
            });
        if (response.conflicts.length)
          throw new Error(
            "Saved timetable contains conflicts. Clear it to start again.",
          );
        if (active)
          setState({
            items: response.items,
            error: "",
            ready: true,
          });
      } catch (error) {
        if (active)
          setState({
            items: [],
            error: errorMessage(error),
            ready: false,
          });
      }
    }
    restore();
    return () => {
      active = false;
    };
  }, [user, version]);
  async function commit(next) {
    if (pending.current) return false;
    pending.current = true;
    setBusy(true);
    try {
      const body = {
        dataset_version: version,
        items: refs(next),
      };
      const result = await validateTimetable(body);
      if (result.conflicts.length) {
        setConflicts({
          pairs: result.conflicts,
          items: result.items,
        });
        return false;
      }
      if (user) await api.put("/timetable", body);
      else localStorage.setItem("ku-timetable-v2", JSON.stringify(body));
      setState({
        items: result.items,
        error: "",
        ready: true,
      });
      return true;
    } catch (error) {
      setState((old) => ({
        ...old,
        error: errorMessage(error),
      }));
      return false;
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  async function add(course, section) {
    if (
      !state.ready ||
      state.items.some(
        (item) => item.course.subject_code === course.subject_code,
      )
    )
      return false;
    return commit([
      ...state.items,
      {
        course,
        section,
      },
    ]);
  }
  const value = {
    ...state,
    busy,
    metadata,
    conflictCodes: conflicts
      ? conflicts.pairs.flatMap((p) => [
          p.first.subject_code,
          p.second.subject_code,
        ])
      : [],
    add,
    remove: (code) =>
      commit(state.items.filter((i) => i.course.subject_code !== code)),
    clear: () => commit([]),
  };
  return (
    <TimetableContext.Provider value={value}>
      {children}
      {conflicts && (
        <Modal
          title={t("Timetable conflict")}
          onClose={() => setConflicts(null)}
        >
          <p>
            {t(
              "This section was not added. Choose a different section or remove the overlapping course.",
            )}
          </p>
          <ul>
            {conflicts.pairs.map((pair, index) => (
              <li key={index}>
                {pair.first.subject_code}
                {t(" (section ")}
                {pair.first.section_id}
                {t(") and")} {pair.second.subject_code}
                {t(" (section ")}
                {pair.second.section_id}): {t(pair.day)} {pair.start}–{pair.end}
              </li>
            ))}
          </ul>
        </Modal>
      )}
    </TimetableContext.Provider>
  );
}

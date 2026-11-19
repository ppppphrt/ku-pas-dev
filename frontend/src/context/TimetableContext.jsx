import { useLanguage } from "../hooks/useLanguage";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { TimetableContext } from "./timetable";
import { api, errorMessage, validateTimetable } from "../services/courseApi";
import { loadGuest, refs, overlap } from "../utils/timetable";
import {
  loadRegistration,
  privateRegistration,
  registrationItems,
} from "../utils/registeredTimetable";
import { DEMO_SECTIONS, DEMO_TIMETABLE_KEY } from "../utils/demoStudent";
import Modal from "../components/Modal";
export function TimetableProvider({ metadata, children }) {
  const { t } = useLanguage();
  const { user, demoStudent } = useAuth();
  const storageKey = demoStudent ? DEMO_TIMETABLE_KEY : "ku-timetable-v2";
  const registrationKey = `ku-registered-v1:${user?.id || storageKey}`;
  const [registration, setRegistration] = useState(() =>
    loadRegistration(registrationKey),
  );
  const registeredItems = registrationItems(registration);
  const [state, setState] = useState({
    items: [],
    error: "",
    ready: false,
  });
  const [busy, setBusy] = useState(false);
  const allItems = [...registeredItems, ...state.items];
  const [conflicts, setConflicts] = useState(null);
  const version = metadata.dataset_version;
  const pending = useRef(false);
  useEffect(() => {
    let active = true;
    async function restore() {
      try {
        const saved = user
          ? (await api.get("/timetable")).data
          : loadGuest(localStorage, version, storageKey);
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
  }, [user, version, storageKey]);
  async function commit(next, imported = registeredItems) {
    if (pending.current) return false;
    pending.current = true;
    setBusy(true);
    try {
      const body = {
        dataset_version: version,
        items: refs(next),
      };
      const result = await validateTimetable(body);
      const pairs = [...result.conflicts];
      const combined = [...imported, ...result.items];
      for (let i = 0; i < imported.length; i++) {
        for (let j = i + 1; j < combined.length; j++) {
          for (const a of combined[i].section.time_slots) {
            for (const b of combined[j].section.time_slots) {
              if (overlap(a, b))
                pairs.push({
                  first: refs([combined[i]])[0],
                  second: refs([combined[j]])[0],
                  day: a.day,
                  start: a.start > b.start ? a.start : b.start,
                  end: a.end < b.end ? a.end : b.end,
                });
            }
          }
        }
      }
      if (pairs.length) {
        setConflicts({
          pairs,
          items: combined,
        });
        return false;
      }
      if (user) await api.put("/timetable", body);
      else localStorage.setItem(storageKey, JSON.stringify(body));
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
      registeredItems.some((item) => !item.section.schedule_complete) ||
      allItems.some((item) => item.course.subject_code === course.subject_code)
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
  async function importRegistration(record) {
    try {
      const minimal = privateRegistration(record);
      const imported = registrationItems(minimal);
      const codes = new Set(imported.map(({ course }) => course.subject_code));
      const planned = state.items.filter(
        ({ course }) => !codes.has(course.subject_code),
      );
      // Check storage before changing the existing planner; never persist the access key.
      const previous = sessionStorage.getItem(registrationKey);
      sessionStorage.setItem(registrationKey, JSON.stringify(minimal));
      if (previous === null) sessionStorage.removeItem(registrationKey);
      else sessionStorage.setItem(registrationKey, previous);
      if (!(await commit(planned, imported))) return false;
      if (minimal.courses.length)
        sessionStorage.setItem(registrationKey, JSON.stringify(minimal));
      else sessionStorage.removeItem(registrationKey);
      setRegistration(minimal.courses.length ? minimal : null);
      return true;
    } catch (error) {
      setState((old) => ({ ...old, error: errorMessage(error) }));
      return false;
    }
  }
  const value = {
    ...state,
    items: allItems,
    catalogItems: state.items,
    registeredItems,
    registration,
    importRegistration,
    forgetRegistration: () => {
      sessionStorage.removeItem(registrationKey);
      setRegistration(null);
    },
    busy,
    metadata,
    conflictCodes: conflicts
      ? conflicts.pairs.flatMap((p) => [
          p.first.subject_code,
          p.second.subject_code,
        ])
      : [],
    add,
    addPlan: (items) => {
      if (
        !state.ready ||
        !items.length ||
        registeredItems.some((item) => !item.section.schedule_complete)
      )
        return false;
      const codes = new Set(allItems.map(({ course }) => course.subject_code));
      if (items.some(({ course }) => codes.has(course.subject_code)))
        return false;
      const next = [...state.items, ...items];
      if (
        next.reduce((sum, { course }) => sum + course.credits, 0) >
        metadata.max_credits
      )
        return false;
      return commit(next);
    },
    importDemo: async () => {
      if (!demoStudent || !state.ready) return false;
      const existingCodes = new Set(
        state.items.map((item) => item.course.subject_code),
      );
      const added = DEMO_SECTIONS.filter(
        (ref) => !existingCodes.has(ref.subject_code),
      );
      if (!added.length) return true;
      return commit([
        ...state.items,
        ...added.map((ref) => ({
          course: { subject_code: ref.subject_code },
          section: { section_id: ref.section_id },
        })),
      ]);
    },
    remove: (code) =>
      registeredItems.some(({ course }) => course.subject_code === code)
        ? importRegistration({
            ...registration,
            courses: registration.courses.filter(
              (course) => course.subject_code !== code,
            ),
          })
        : commit(state.items.filter((i) => i.course.subject_code !== code)),
    clear: async () => {
      if (!(await commit([], []))) return false;
      sessionStorage.removeItem(registrationKey);
      setRegistration(null);
      return true;
    },
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

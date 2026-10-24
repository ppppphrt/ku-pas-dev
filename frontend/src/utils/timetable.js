export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const minutes = (time) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};
export const overlap = (a, b) =>
  a.day === b.day && a.start < b.end && b.start < a.end;
export const refs = (items) =>
  items.map(({ course, section }) => ({
    subject_code: course.subject_code,
    section_id: section.section_id,
  }));
export function creditState(items, minimum, maximum) {
  const credits = items.reduce((total, item) => total + item.course.credits, 0);
  return {
    credits,
    count: items.length,
    status:
      credits > maximum ? "Exceeded" : credits < minimum ? "Warning" : "Normal",
  };
}
const COLORS = [
  "#dbeafe",
  "#fce7f3",
  "#dcfce7",
  "#fef3c7",
  "#ede9fe",
  "#cffafe",
];
export function courseColor(code) {
  let hash = 0;
  for (const char of code) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return COLORS[hash % COLORS.length];
}
export function loadGuest(storage, version) {
  const raw = storage.getItem("ku-timetable-v2");
  if (!raw) return { items: [] };
  const saved = JSON.parse(raw);
  if (saved.dataset_version !== version)
    throw new Error(
      "The catalog changed. Clear the old timetable before using this snapshot.",
    );
  if (
    !Array.isArray(saved.items) ||
    saved.items.some(
      (i) =>
        typeof i.subject_code !== "string" || typeof i.section_id !== "string",
    )
  )
    throw new Error("Saved timetable is damaged. Clear it to start again.");
  return saved;
}

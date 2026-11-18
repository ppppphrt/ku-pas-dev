import { overlap } from "./timetable";

export function arrangeRequired(rows, saved) {
  const occupied = saved.flatMap(({ section }) => section.time_slots);
  const savedCodes = new Set(saved.map(({ course }) => course.subject_code));
  const codes = rows.map(({ course }) => course.subject_code);
  if (
    new Set(codes).size !== codes.length ||
    codes.some((code) => savedCodes.has(code))
  )
    return null;
  const options = rows
    .map(({ course, locked }) => ({
      course,
      sections: course.sections.filter(
        (section) =>
          section.campus === "บางเขน" &&
          section.schedule_complete &&
          section.time_slots.length &&
          (!locked || section.section_id === locked),
      ),
    }))
    .sort((a, b) => a.sections.length - b.sections.length);
  let attempts = 0;
  function choose(index, slots) {
    if (index === options.length) return [];
    const { course, sections } = options[index];
    for (const section of sections) {
      if (++attempts > 20000) return null;
      if (
        section.time_slots.some((slot) =>
          slots.some((other) => overlap(slot, other)),
        )
      )
        continue;
      const remaining = choose(index + 1, [...slots, ...section.time_slots]);
      if (remaining) return [{ course, section }, ...remaining];
    }
    return null;
  }
  return choose(0, occupied);
}

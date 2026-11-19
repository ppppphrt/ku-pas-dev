// Registration records use KU-EDU's times, never a guessed catalog section.
const DAY = {
  M: "Mon",
  Mo: "Mon",
  Mon: "Mon",
  Tu: "Tue",
  Tue: "Tue",
  W: "Wed",
  We: "Wed",
  Wed: "Wed",
  Th: "Thu",
  Thu: "Thu",
  F: "Fri",
  Fr: "Fri",
  Fri: "Fri",
  Sa: "Sat",
  Sat: "Sat",
  Su: "Sun",
  Sun: "Sun",
};
export function parseRegisteredSchedule(value) {
  const match = value
    .trim()
    .match(
      /^(\w+)\s+(\d{1,2}):([0-5]\d)\s*[-–]\s*(\d{1,2}):([0-5]\d)(?:\s+(.*))?$/,
    );
  if (
    !match ||
    !DAY[match[1]] ||
    Number(match[2]) > 23 ||
    Number(match[4]) > 23
  )
    return null;
  const start = `${match[2].padStart(2, "0")}:${match[3]}`;
  const end = `${match[4].padStart(2, "0")}:${match[5]}`;
  return start < end
    ? { day: DAY[match[1]], start, end, location: match[6] || null }
    : null;
}
export function registrationItems(record) {
  if (!record) return [];
  if (
    !Number.isInteger(record.academic_year) ||
    record.academic_year < 2500 ||
    record.academic_year > 2700 ||
    ![1, 2, 3].includes(record.semester) ||
    !Array.isArray(record.courses) ||
    record.courses.length > 100
  )
    throw new Error("Invalid registered timetable.");
  const codes = new Set();
  return record.courses.map((row) => {
    if (
      typeof row.subject_code !== "string" ||
      typeof row.subject_name !== "string" ||
      typeof row.enroll_status !== "string" ||
      !Array.isArray(row.schedules) ||
      row.schedules.some((s) => typeof s !== "string") ||
      codes.has(row.subject_code)
    )
      throw new Error("Invalid registered timetable.");
    codes.add(row.subject_code);
    const slots = row.schedules.map(parseRegisteredSchedule);
    return {
      source: "KU-EDU",
      enroll_status: row.enroll_status,
      raw_schedules: row.schedules,
      course: {
        subject_code: row.subject_code,
        subject_name_th: row.subject_name,
        subject_name_en: row.subject_name,
        credits: null,
      },
      section: {
        section_id: `kuedu:${row.subject_code}`,
        section_code: "KU-EDU",
        time_slots: slots.filter(Boolean),
        schedule_complete: slots.length > 0 && slots.every(Boolean),
      },
    };
  });
}
export function privateRegistration(record) {
  const minimal = {
    academic_year: record.academic_year,
    semester: record.semester,
    courses: record.courses.map(
      ({ subject_code, subject_name, enroll_status, schedules }) => ({
        subject_code,
        subject_name,
        enroll_status,
        schedules,
      }),
    ),
  };
  registrationItems(minimal);
  return minimal;
}
export function loadRegistration(key) {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const record = JSON.parse(raw);
    registrationItems(record);
    return record;
  } catch {
    sessionStorage.removeItem(key);
    return null;
  }
}

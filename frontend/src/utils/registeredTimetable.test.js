import { expect, it } from "vitest";
import {
  parseRegisteredSchedule,
  registrationItems,
  privateRegistration,
} from "./registeredTimetable";
it("parses KU-EDU weekday aliases, single-digit hours and locations", () => {
  for (const [input, day] of [
    ["M", "Mon"],
    ["Tu", "Tue"],
    ["W", "Wed"],
    ["Th", "Thu"],
    ["F", "Fri"],
    ["Sa", "Sat"],
    ["Su", "Sun"],
  ])
    expect(parseRegisteredSchedule(`${input} 9:00-12:00 Test room`)).toEqual({
      day,
      start: "09:00",
      end: "12:00",
      location: "Test room",
    });
  for (const input of [
    "Th 23:00-25:00 x",
    "Th 11:00-09:00 x",
    "Th 9:60-12:00 x",
    "TBA",
    "T 09:00-10:00 x",
  ])
    expect(parseRegisteredSchedule(input)).toBeNull();
});
it("keeps missing or partly unreadable times explicit and strips private fields", () => {
  const raw = {
    academic_year: 2568,
    semester: 2,
    access_token: "never-store",
    courses: [
      {
        subject_code: "001-65",
        subject_name: "Real",
        enroll_status: "A",
        instrs: [{ account: "private" }],
        schedules: ["Th 9:00-12:00 room", "TBA"],
      },
    ],
  };
  const minimal = privateRegistration(raw);
  expect(JSON.stringify(minimal)).not.toMatch(/private|never-store|instrs/);
  const [item] = registrationItems(minimal);
  expect(item.section.time_slots).toHaveLength(1);
  expect(item.section.schedule_complete).toBe(false);
  expect(item.course.credits).toBeNull();
  expect(item.section.section_code).toBe("KU-EDU");
  expect(() =>
    registrationItems({
      ...minimal,
      courses: [...minimal.courses, ...minimal.courses],
    }),
  ).toThrow();
});

import { expect, it } from "vitest";
import { arrangeRequired } from "./arrangeRequired";

const section = (id, start, end) => ({
  campus: "บางเขน",
  schedule_complete: true,
  section_id: id,
  time_slots: [{ day: "Mon", start, end }],
});
const a = section("a1", "09:00", "11:00");
const alternate = section("a2", "11:00", "12:00");
const b = section("b1", "10:00", "11:00");
const rows = [
  { course: { subject_code: "a", sections: [a, alternate] } },
  { course: { subject_code: "b", sections: [b] } },
];

it("schedules every required course and respects locked sections", () => {
  expect(
    arrangeRequired(rows, []).map(({ section }) => section.section_id),
  ).toEqual(["b1", "a2"]);
  expect(
    arrangeRequired([{ ...rows[0], locked: "a1" }, rows[1]], []),
  ).toBeNull();
  expect(
    arrangeRequired(rows, [
      { course: { subject_code: "base" }, section: alternate },
    ]),
  ).toBeNull();
});

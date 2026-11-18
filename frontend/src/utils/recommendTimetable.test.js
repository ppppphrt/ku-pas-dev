import { expect, it } from "vitest";
import { recommendTimetables } from "./recommendTimetable";

function candidate(
  code,
  day,
  start,
  end,
  competencies = [],
  status = "verified",
) {
  return {
    course: { subject_code: code, campus: "บางเขน", credits: 3 },
    classification: { competencies, status },
    sections: [
      {
        can_plan: true,
        section: {
          section_id: code,
          campus: "บางเขน",
          schedule_complete: true,
          time_slots: [{ day, start, end }],
        },
      },
    ],
  };
}

it("chooses compact or competency-focused sections and respects saved classes and credits", () => {
  const existing = candidate("saved", "Mon", "09:00", "10:00");
  const saved = [
    { course: existing.course, section: existing.sections[0].section },
  ];
  const results = [
    existing,
    candidate("overlap", "Mon", "09:30", "10:30", [1, 2, 3]),
    candidate("compact", "Mon", "10:00", "11:00"),
    candidate("skills", "Tue", "09:00", "10:00", [2, 3], "mock"),
    candidate("target", "Wed", "09:00", "10:00", [1]),
    candidate("unknown", "Thu", "09:00", "10:00", [1, 2, 3, 4], "unknown"),
  ];
  const codes = (items) => items.map(({ course }) => course.subject_code);
  const plans = recommendTimetables(results, saved, 6);
  expect(codes(plans.time)).toEqual(["compact"]);
  expect(codes(plans.competency)).toEqual(["skills"]);
  expect(codes(recommendTimetables(results, saved, 6, 1).competency)).toEqual([
    "target",
  ]);
  expect(recommendTimetables(results, saved, 3)).toEqual({
    time: [],
    competency: [],
  });
});

it("tries an alternative section when the first section clashes with another selected course", () => {
  const a = candidate("a", "Mon", "09:00", "10:00", [1]);
  const b = candidate("b", "Mon", "09:30", "10:30", [2]);
  a.sections.push(
    candidate("a-later", "Mon", "11:00", "12:00", [1]).sections[0],
  );
  const plans = recommendTimetables([a, b], [], 6);
  for (const plan of Object.values(plans)) {
    expect(plan.map(({ section }) => section.section_id)).toEqual([
      "a-later",
      "b",
    ]);
  }
});

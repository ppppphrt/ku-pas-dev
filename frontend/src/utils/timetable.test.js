import { describe, it, expect } from "vitest";
import { overlap, creditState, courseColor, loadGuest } from "./timetable";

describe("timetable rules", () => {
  it("allows consecutive classes and different days", () => {
    const first = { day: "Mon", start: "09:00", end: "10:00" };
    expect(overlap(first, { ...first, start: "10:00", end: "11:00" })).toBe(
      false,
    );
    expect(overlap(first, { ...first, day: "Tue" })).toBe(false);
    expect(overlap(first, { ...first, start: "09:30" })).toBe(true);
  });
  it("calculates fractional credits and thresholds", () => {
    expect(
      creditState(
        [{ course: { credits: 3 } }, { course: { credits: 1.5 } }],
        3,
        4,
      ),
    ).toEqual({ credits: 4.5, count: 2, status: "Exceeded" });
    expect(creditState([], 3, 4).status).toBe("Warning");
    expect(creditState([{ course: { credits: 3 } }], 3, 4).status).toBe(
      "Normal",
    );
    expect(courseColor("001-61")).toBe(courseColor("001-61"));
  });
  it("exposes corrupt and old saved data", () => {
    expect(() => loadGuest({ getItem: () => "{broken" }, "v1")).toThrow();
    expect(() =>
      loadGuest(
        {
          getItem: () => JSON.stringify({ dataset_version: "old", items: [] }),
        },
        "v1",
      ),
    ).toThrow(/catalog changed/);
    expect(loadGuest({ getItem: () => null }, "v1")).toEqual({ items: [] });
  });
});

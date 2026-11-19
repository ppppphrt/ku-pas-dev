import { afterEach, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App";
import { api } from "../services/courseApi";

const KEY = "synthetic-test-access-code-00000000000001";
const courses = [
  {
    subject_code: "00000001-65",
    subject_name: "Registered live class",
    enroll_status: "A",
    instrs: [
      { first_name: "Private", last_name: "Teacher", account: "never-save" },
    ],
    schedules: ["Th 9:00-12:00 Live-room"],
  },
  {
    subject_code: "00000002-65",
    subject_name: "Other status class",
    enroll_status: "D",
    instrs: [],
    schedules: ["Th 9:00-12:00 Other-room"],
  },
];
afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});
it("imports selected live classes, restores on refresh, and clears the session timetable", async () => {
  localStorage.setItem("ku-language", "en");
  window.history.replaceState({}, "", "/enrollments");
  vi.spyOn(api, "get").mockResolvedValue({
    data: {
      dataset_version: "test",
      enrollment_enabled: true,
      min_credits: 9,
      max_credits: 22,
      data_source: "Test snapshot",
    },
  });
  const post = vi.spyOn(api, "post").mockImplementation(async (path, body) => ({
    data:
      path === "/enrollments/semester"
        ? { academic_year: 2568, semester: 2, courses }
        : { items: [], conflicts: [], ...body },
  }));
  const user = userEvent.setup();
  let view = render(<App />);
  await user.type(await screen.findByLabelText("Student access code"), KEY);
  await user.type(screen.getByLabelText("Academic year (B.E.)"), "2568");
  await user.selectOptions(screen.getByLabelText("Semester"), "2");
  await user.click(
    screen.getByRole("button", { name: "Fetch registered courses" }),
  );
  const button = await screen.findByRole("button", {
    name: "Use selected courses in timetable",
  });
  await waitFor(() => expect(button).toBeEnabled());
  await user.click(button);
  await screen.findByRole("heading", { name: "Timetable Planner" });
  expect(
    screen.getByRole("link", { name: "Registered live class" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("link", { name: "Other status class" }),
  ).not.toBeInTheDocument();
  expect(screen.getAllByText("09:00–12:00").length).toBeGreaterThan(0);
  const stored = sessionStorage.getItem("ku-registered-v1:ku-timetable-v2");
  expect(stored).toContain("Registered live class");
  expect(stored).not.toMatch(
    /never-save|Private|access_code|synthetic-test-access/,
  );
  expect(localStorage.getItem("ku-timetable-v2")).not.toContain(
    "Registered live class",
  );
  expect(
    post.mock.calls
      .filter(([path]) => path === "/timetable/validate")
      .every(([, body]) => body.items.length === 0),
  ).toBe(true);
  view.unmount();
  render(<App />);
  expect(
    await screen.findByRole("link", { name: "Registered live class" }),
  ).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Clear timetable" }));
  await user.click(screen.getByRole("button", { name: "Clear all sections" }));
  await waitFor(() =>
    expect(
      screen.queryByRole("link", { name: "Registered live class" }),
    ).not.toBeInTheDocument(),
  );
  expect(sessionStorage.getItem("ku-registered-v1:ku-timetable-v2")).toBeNull();
});

it("sends only occupied times and codes to GE search, without synthetic catalog section refs", async () => {
  localStorage.setItem("ku-language", "en");
  sessionStorage.setItem(
    "ku-registered-v1:ku-timetable-v2",
    JSON.stringify({ academic_year: 2568, semester: 2, courses: [courses[0]] }),
  );
  window.history.replaceState({}, "", "/chat?ge=fit");
  vi.spyOn(api, "get").mockResolvedValue({
    data: { dataset_version: "test", min_credits: 9, max_credits: 22 },
  });
  const post = vi.spyOn(api, "post").mockImplementation(async (path, body) => {
    if (path.startsWith("/chat"))
      throw new Error("Synthetic search stopped after request inspection");
    return { data: { items: [], conflicts: [], ...body } };
  });
  const user = userEvent.setup();
  render(<App />);
  await user.type(await screen.findByLabelText("Ask about GE courses"), "ภาษา");
  await user.click(screen.getByRole("button", { name: "Send message" }));
  await waitFor(() =>
    expect(post.mock.calls.some(([path]) => path.startsWith("/chat"))).toBe(
      true,
    ),
  );
  const body = post.mock.calls.find(([path]) => path.startsWith("/chat"))[1];
  expect(body.items).toEqual([]);
  expect(body.occupied_slots).toEqual([
    { day: "Thu", start: "09:00", end: "12:00" },
  ]);
  expect(body.registered_course_codes).toEqual(["00000001-65"]);
  expect(JSON.stringify(body)).not.toMatch(/Private|Teacher|Live-room|kuedu:/);
});

import { beforeAll, afterAll, beforeEach, afterEach, expect, it } from "vitest";
import {
  render,
  screen,
  waitFor,
  within,
  cleanup,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import App from "../App";

const root = "http://127.0.0.1:8000";
function course(code, name, start) {
  return {
    subject_code: code,
    subject_name_en: name,
    subject_name_th: "วิชาทดสอบ",
    subject_desc_en: "Course description",
    credits: 3,
    faculty: "Science",
    sections: [
      {
        section_id: "s" + code,
        section_code: "1",
        faculty: "Science",
        campus: "Bangkhen",
        schedule_complete: true,
        time_slots: [{ day: "Mon", start, end: "11:00" }],
      },
    ],
  };
}
const courses = [
  course("001", "Programming", "09:00"),
  course("002", "Calculus", "10:00"),
];
const server = setupServer(
  http.get(`${root}/metadata`, () =>
    HttpResponse.json({
      dataset_version: "test",
      faculties: ["Science"],
      semantic_ready: true,
      min_credits: 9,
      max_credits: 22,
      data_source: "Test snapshot",
    }),
  ),
  http.get(`${root}/courses`, () =>
    HttpResponse.json({ courses, total_courses: 2, has_more: false }),
  ),
  http.get(`${root}/courses/:code`, ({ params }) =>
    HttpResponse.json(courses.find((c) => c.subject_code === params.code)),
  ),
  http.get(`${root}/keyword-search`, ({ request }) => {
    const q = new URL(request.url).searchParams.get("q");
    const results = courses.filter((c) =>
      c.subject_name_en.toLowerCase().includes(q.toLowerCase()),
    );
    return HttpResponse.json({
      results,
      total_results: results.length,
      has_more: false,
    });
  }),
  http.post(`${root}/timetable/validate`, async ({ request }) => {
    const { items } = await request.json();
    const selected = items.map((ref) => {
      const c = courses.find((c) => c.subject_code === ref.subject_code);
      return { course: c, section: c.sections[0] };
    });
    return HttpResponse.json({
      items: selected,
      conflicts:
        selected.length > 1
          ? [
              {
                first: items[0],
                second: items[1],
                day: "Mon",
                start: "10:00",
                end: "11:00",
              },
            ]
          : [],
      total_credits: selected.length * 3,
    });
  }),
);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());
afterEach(() => server.resetHandlers());
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState({}, "", "/");
});

async function openCourse(user, name) {
  await user.click(await screen.findByRole("link", { name, exact: true }));
  await user.click(await screen.findByRole("radio"));
  const add = screen.getByRole("button", { name: "Add selected section" });
  await waitFor(() => expect(add).toBeEnabled());
  await user.click(add);
}

it("adds, restores, blocks a conflict, removes, and clears with confirmation", async () => {
  const user = userEvent.setup();
  render(<App />);
  await openCourse(user, "Programming");
  await screen.findByText("Section added to your timetable.");
  expect(
    JSON.parse(localStorage.getItem("ku-timetable-v2")).items,
  ).toHaveLength(1);
  await user.click(screen.getByRole("link", { name: "View timetable" }));
  expect(await screen.findByText("1 courses")).toBeInTheDocument();
  expect(
    screen.getByText("3 credits", { selector: "strong" }),
  ).toBeInTheDocument();
  cleanup();
  render(<App />);
  await screen.findByText("1 courses");
  await user.click(
    within(screen.getByRole("navigation")).getByRole("link", {
      name: "Course Discovery",
      exact: true,
    }),
  );
  await openCourse(user, "Calculus");
  const conflict = await screen.findByRole("dialog", {
    name: "Timetable conflict",
  });
  expect(within(conflict).getByText(/001.*002/)).toBeInTheDocument();
  expect(
    JSON.parse(localStorage.getItem("ku-timetable-v2")).items,
  ).toHaveLength(1);
  await user.click(within(conflict).getByRole("button", { name: "Close" }));
  await user.click(
    screen.getByRole("link", { name: "Timetable Planner", exact: true }),
  );
  await user.click(screen.getByRole("button", { name: "Remove 001" }));
  await screen.findByText("0 courses");
  await user.click(
    within(screen.getByRole("navigation")).getByRole("link", {
      name: "Course Discovery",
      exact: true,
    }),
  );
  await openCourse(user, "Programming");
  await screen.findByText("Section added to your timetable.");
  await user.click(screen.getByRole("link", { name: "View timetable" }));
  await user.click(
    screen.getByRole("button", { name: "Clear timetable", exact: true }),
  );
  expect(
    JSON.parse(localStorage.getItem("ku-timetable-v2")).items,
  ).toHaveLength(1);
  const dialog = screen.getByRole("dialog", { name: "Clear timetable?" });
  await user.click(
    within(dialog).getByRole("button", { name: "Clear all sections" }),
  );
  await screen.findByText("0 courses");
  expect(
    JSON.parse(localStorage.getItem("ku-timetable-v2")).items,
  ).toHaveLength(0);
});

it("disables blank search, searches, applies URL filters and resets them", async () => {
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole("link", { name: "Programming", exact: true });
  expect(screen.getByRole("button", { name: "Search courses" })).toBeDisabled();
  await user.type(
    screen.getByRole("textbox", { name: "Course search" }),
    "Programming",
  );
  await user.click(screen.getByRole("button", { name: "Search courses" }));
  await screen.findByText(/1 courses ·/);
  await user.selectOptions(screen.getByLabelText("Faculty"), "Science");
  await user.click(screen.getByLabelText("Mon", { exact: true }));
  await user.click(screen.getByRole("button", { name: "Apply filters" }));
  await waitFor(() =>
    expect(window.location.search).toContain("faculty=Science"),
  );
  expect(window.location.search).toContain("days=Mon");
  await user.click(screen.getByRole("button", { name: "Reset filters" }));
  await waitFor(() => expect(window.location.search).not.toContain("faculty"));
  expect(window.location.search).toContain("q=Programming");
});

it("shows network errors and supports retry", async () => {
  server.use(
    http.get(
      `${root}/courses`,
      () =>
        HttpResponse.json(
          { error: { message: "Catalog temporarily unavailable" } },
          { status: 503 },
        ),
      { once: true },
    ),
  );
  const user = userEvent.setup();
  render(<App />);
  await screen.findByText("Catalog temporarily unavailable");
  await user.click(screen.getByRole("button", { name: "Retry", exact: true }));
  await screen.findByRole("link", { name: "Programming", exact: true });
});

it("allows explicit recovery from damaged saved data", async () => {
  localStorage.setItem("ku-timetable-v2", "{broken");
  window.history.replaceState({}, "", "/timetable");
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole("button", { name: "Clear timetable", exact: true });
  await waitFor(() =>
    expect(screen.getAllByRole("alert").length).toBeGreaterThan(0),
  );
  await user.click(
    screen.getByRole("button", { name: "Clear timetable", exact: true }),
  );
  await user.click(
    within(screen.getByRole("dialog")).getByRole("button", {
      name: "Clear all sections",
    }),
  );
  await waitFor(() => expect(screen.queryAllByRole("alert")).toHaveLength(0));
  expect(JSON.parse(localStorage.getItem("ku-timetable-v2")).items).toEqual([]);
});

it("chats with context, labels mocks and shares the existing timetable", async () => {
  const requests = [];
  server.use(
    http.post(`${root}/chat`, async ({ request }) => {
      const body = await request.json();
      requests.push(body);
      return HttpResponse.json({
        state: {
          ...body.state,
          interest: "ภาษา",
          days: body.message.includes("ศุกร์") ? ["Fri"] : [],
        },
        engine: "local-rules",
        total_results: 1,
        message: "พบวิชาทดลอง",
        notice: "ข้อมูลจำลอง ยังยืนยันสิทธิ์ไม่ได้",
        sources: {
          catalog: {
            source_url: "https://kudrive.ku.ac.th",
            updated_at: "2026-10-24",
          },
          ge: { source_url: "demo://test", updated_at: "2026-10-24" },
        },
        results: [
          {
            course: courses[0],
            classification: {
              groups: ["ภาษากับการสื่อสาร"],
              competencies: [1],
              status: "mock",
            },
            sections: [
              {
                section: courses[0].sections[0],
                offering: {
                  offered: true,
                  remaining: 2,
                  programs: ["regular"],
                  status: "mock",
                  eligibility_note: "ข้อมูลจำลอง",
                },
                eligibility: "unknown",
                can_plan: true,
              },
            ],
          },
        ],
      });
    }),
  );
  window.history.replaceState({}, "", "/chat");
  const user = userEvent.setup();
  render(<App />);
  const input = await screen.findByLabelText("ถามเรื่องรายวิชา GE");
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "สนใจภาษา" })).toBeEnabled(),
  );
  await user.type(input, "สนใจภาษา");
  await user.click(screen.getByRole("button", { name: "ส่งข้อความ" }));
  await screen.findByText("ผลล่าสุด · 1 วิชา");
  expect(screen.getByText("GE จำลอง")).toBeInTheDocument();
  expect(screen.getByText(/โหมดทดลองฟรี/)).toBeInTheDocument();
  await user.type(input, "เฉพาะวันศุกร์");
  await user.click(screen.getByRole("button", { name: "ส่งข้อความ" }));
  await waitFor(() => expect(requests).toHaveLength(2));
  expect(requests[1].state.interest).toBe("ภาษา");
  await user.click(screen.getByText(/ดูหมู่และเวลาเรียน/));
  await user.click(screen.getByRole("button", { name: "เพิ่มหมู่นี้ลงตาราง" }));
  await screen.findByText(/เพิ่ม 001 หมู่ 1 ลงตารางแล้ว/);
  expect(
    JSON.parse(localStorage.getItem("ku-timetable-v2")).items,
  ).toHaveLength(1);
  await user.click(screen.getByRole("link", { name: /ดูตารางของฉัน/ }));
  await screen.findByText("1 courses");
});

it("keeps the chat draft after an API error so the user can retry", async () => {
  server.use(
    http.post(`${root}/chat`, () =>
      HttpResponse.json(
        { error: { message: "Chat unavailable" } },
        { status: 503 },
      ),
    ),
  );
  window.history.replaceState({}, "", "/chat");
  const user = userEvent.setup();
  render(<App />);
  const input = await screen.findByLabelText("ถามเรื่องรายวิชา GE");
  await user.type(input, "สนใจภาษา");
  const send = screen.getByRole("button", { name: "ส่งข้อความ" });
  await waitFor(() => expect(send).toBeEnabled());
  await user.click(send);
  await screen.findByText(/Chat unavailable/);
  expect(input).toHaveValue("สนใจภาษา");
  expect(send).toBeEnabled();
});

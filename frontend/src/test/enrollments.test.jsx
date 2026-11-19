import { afterEach, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { LanguageProvider } from "../context/LanguageContext";
import EnrollmentPage from "../pages/EnrollmentPage";
import { api } from "../services/courseApi";

const KEY = "synthetic-private-access-code-00000000001";
const rows = [
  {
    subject_code: "00000001-65",
    subject_name: "Synthetic course",
    enroll_status: "D",
    instrs: [{ first_name: "Test", last_name: "Teacher", account: "test" }],
    schedules: ["Th 16:30-19:30 Test-room"],
  },
];
afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});
function open(enabled = true) {
  localStorage.setItem("ku-language", "en");
  return render(
    <LanguageProvider>
      <MemoryRouter>
        <EnrollmentPage metadata={{ enrollment_enabled: enabled }} />
      </MemoryRouter>
    </LanguageProvider>,
  );
}
async function fill(user) {
  await user.type(screen.getByLabelText("Student access code"), KEY);
  await user.type(screen.getByLabelText("Academic year (B.E.)"), "2568");
  await user.selectOptions(screen.getByLabelText("Semester"), "2");
}
it("submits a BE year with a private header and clears data when the identity or period changes", async () => {
  const post = vi
    .spyOn(api, "post")
    .mockResolvedValue({
      data: { academic_year: 2568, semester: 2, courses: rows },
    });
  const user = userEvent.setup();
  open();
  await fill(user);
  await user.click(
    screen.getByRole("button", { name: "Fetch registered courses" }),
  );
  expect(await screen.findByText("Synthetic course")).toBeInTheDocument();
  expect(screen.getByText("Th 16:30-19:30 Test-room")).toBeInTheDocument();
  expect(screen.getByText("D")).toBeInTheDocument();
  expect(post).toHaveBeenCalledWith(
    "/enrollments/semester",
    { academic_year: 2568, semester: 2 },
    expect.objectContaining({ headers: { "X-Enrollment-Key": KEY } }),
  );
  expect(JSON.stringify({ ...localStorage, ...sessionStorage })).not.toContain(
    KEY,
  );
  expect(JSON.stringify({ ...localStorage, ...sessionStorage })).not.toContain(
    "Synthetic course",
  );
  await user.selectOptions(screen.getByLabelText("Semester"), "1");
  expect(screen.queryByText("Synthetic course")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Clear private data" }));
  expect(screen.getByLabelText("Student access code")).toHaveValue("");
});
it("handles empty results, upstream errors and retry without stale private results", async () => {
  const post = vi
    .spyOn(api, "post")
    .mockResolvedValueOnce({
      data: { academic_year: 2568, semester: 2, courses: [] },
    })
    .mockRejectedValueOnce({
      response: {
        status: 403,
        data: { error: { message: "Invalid or expired student access code." } },
      },
    })
    .mockResolvedValueOnce({
      data: { academic_year: 2568, semester: 2, courses: rows },
    });
  const user = userEvent.setup();
  open();
  await fill(user);
  await user.click(
    screen.getByRole("button", { name: "Fetch registered courses" }),
  );
  await screen.findByText(/No enrollment records found/);
  await user.click(
    screen.getByRole("button", { name: "Fetch registered courses" }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Invalid or expired",
  );
  expect(
    screen.queryByText(/No enrollment records found/),
  ).not.toBeInTheDocument();
  await user.click(
    screen.getByRole("button", { name: "Fetch registered courses" }),
  );
  await screen.findByText("Synthetic course");
  expect(post).toHaveBeenCalledTimes(3);
});
it("aborts an in-flight lookup when private data is cleared", async () => {
  const post = vi
    .spyOn(api, "post")
    .mockImplementation(
      (_path, _body, options) =>
        new Promise((_resolve, reject) =>
          options.signal.addEventListener("abort", () =>
            reject(new Error("aborted")),
          ),
        ),
    );
  const user = userEvent.setup();
  open();
  await fill(user);
  await user.click(
    screen.getByRole("button", { name: "Fetch registered courses" }),
  );
  await user.click(screen.getByRole("button", { name: "Clear private data" }));
  expect(post.mock.calls[0][2].signal.aborted).toBe(true);
  await waitFor(() =>
    expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
  );
});
it("keeps lookup unavailable until server configuration is ready", () => {
  open(false);
  expect(screen.getByRole("status")).toHaveTextContent("not configured");
  expect(
    screen.queryByLabelText("Student access code"),
  ).not.toBeInTheDocument();
});

import { expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App";
import { api } from "../services/courseApi";
import { DEMO_SECTIONS, DEMO_TIMETABLE_KEY } from "../utils/demoStudent";

vi.mock("../services/courseApi", async (importOriginal) => {
  const original = await importOriginal();
  return { ...original, DEMO_MODE: true };
});

it("imports sample sections into a separate demo timetable and restores them on sign-in", async () => {
  window.history.replaceState({}, "", "/login");
  localStorage.setItem("ku-language", "en");
  const guest = JSON.stringify({ dataset_version: "test", items: [] });
  localStorage.setItem("ku-timetable-v2", guest);
  const get = vi.spyOn(api, "get").mockResolvedValue({
    data: {
      dataset_version: "test",
      min_credits: 9,
      max_credits: 22,
      data_source: "Test",
    },
  });
  const post = vi.spyOn(api, "post").mockImplementation(async (_url, body) => ({
    data: {
      conflicts: [],
      items: body.items.map(({ subject_code, section_id }, index) => ({
        course: {
          subject_code,
          credits: 3,
          subject_name_en: "Sample " + index,
        },
        section: {
          section_id,
          section_code: "1",
          time_slots: [{ day: "Mon", start: "09:00", end: "10:00" }],
        },
      })),
    },
  }));
  try {
    const user = userEvent.setup();
    render(<App />);
    await user.click(
      await screen.findByRole("button", { name: "Sign in as demo student" }),
    );
    const button = await screen.findByRole("button", {
      name: "Import sample timetable",
    });
    await waitFor(() => expect(button).toBeEnabled());
    await user.click(button);
    expect(
      await screen.findByRole("link", { name: "Sample 0" }),
    ).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(DEMO_TIMETABLE_KEY)).items).toEqual(
      DEMO_SECTIONS,
    );
    expect(localStorage.getItem("ku-timetable-v2")).toBe(guest);
    await user.click(screen.getByRole("button", { name: "Sign out" }));
    await screen.findByText(/No courses selected/);
    expect(
      screen.queryByRole("link", { name: "Sample 0" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "Try demo student" }));
    await user.click(
      screen.getByRole("button", { name: "Sign in as demo student" }),
    );
    expect(
      await screen.findByRole("link", { name: "Sample 0" }),
    ).toBeInTheDocument();
    expect(
      post.mock.calls.every(([url]) => url === "/timetable/validate"),
    ).toBe(true);
  } finally {
    get.mockRestore();
    post.mockRestore();
    sessionStorage.clear();
    localStorage.clear();
  }
});

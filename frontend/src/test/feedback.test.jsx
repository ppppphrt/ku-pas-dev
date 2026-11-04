import { afterAll, afterEach, beforeAll, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import ChatFeedback from "../components/ChatFeedback";
import FeedbackReviewPage from "../pages/FeedbackReviewPage";

const root = "http://127.0.0.1:8000";
const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  sessionStorage.clear();
  localStorage.clear();
});
afterAll(() => server.close());

it("requires a reason and explicit consent, with separate training consent off by default", async () => {
  const requests = [];
  server.use(
    http.post(`${root}/feedback`, async ({ request }) => {
      requests.push(await request.json());
      return HttpResponse.json({ id: "f1", status: "pending" });
    }),
  );
  const user = userEvent.setup();
  render(<ChatFeedback receipt="signed-server-evidence" />);
  await user.click(
    screen.getByRole("button", { name: "Give feedback on this answer" }),
  );
  const submit = screen.getByRole("button", { name: "Submit feedback" });
  expect(submit).toBeDisabled();
  await user.type(
    screen.getByLabelText("Reason or suggested correction"),
    "Please clarify the reversed time.",
  );
  expect(submit).toBeDisabled();
  await user.click(
    screen.getByRole("checkbox", { name: /I consent to storing/ }),
  );
  expect(
    screen.getByRole("checkbox", { name: /Allow reviewed/ }),
  ).not.toBeChecked();
  await user.click(submit);
  await screen.findByText("Feedback received and awaiting review.");
  expect(requests).toHaveLength(1);
  expect(requests[0]).toEqual({
    receipt: "signed-server-evidence",
    rating: "not_helpful",
    category: "understanding",
    comment: "Please clarify the reversed time.",
    consent: true,
    allow_training: false,
  });
});

it("keeps reviewer credentials out of URLs/storage and requires source and privacy checks for approval", async () => {
  const calls = [];
  let reviewed = false;
  const item = {
    id: "f1",
    version: 1,
    category: "understanding",
    rating: "not_helpful",
    comment: "Wrong time",
    allow_training: 1,
    dataset_split: "eval",
    snapshot: {
      question: "Friday 16:00–09:00",
      answer: "Friday until 21:00",
      history: [],
      state: {},
      dataset_version: "test-v1",
      evidence: [],
    },
    reviews: [],
  };
  server.use(
    http.get(`${root}/feedback/review`, ({ request }) => {
      expect(new URL(request.url).searchParams.has("key")).toBe(false);
      expect(request.headers.get("X-Feedback-Review-Key")).toBe(
        "test-review-key",
      );
      return HttpResponse.json({ items: reviewed ? [] : [item] });
    }),
    http.get(`${root}/feedback/review/f1`, () => HttpResponse.json(item)),
    http.put(`${root}/feedback/review/f1`, async ({ request }) => {
      calls.push(await request.json());
      reviewed = true;
      return HttpResponse.json({ ...item, status: "approved", version: 2 });
    }),
  );
  const user = userEvent.setup();
  render(<FeedbackReviewPage />);
  await user.type(
    screen.getByLabelText("Reviewer access key"),
    "test-review-key",
  );
  await user.click(screen.getByRole("button", { name: "Open review queue" }));
  await user.click(await screen.findByRole("button", { name: "Review item" }));
  await screen.findByRole("heading", { name: "Review and edit example" });
  const approve = screen.getByRole("button", {
    name: "Approve corrected example",
  });
  expect(approve).toBeDisabled();
  await user.clear(screen.getByLabelText("Reviewed question and context"));
  await user.type(
    screen.getByLabelText("Reviewed question and context"),
    "Friday 16:00–09:00. The end time needs clarification.",
  );
  await user.clear(screen.getByLabelText("Corrected answer"));
  await user.type(
    screen.getByLabelText("Corrected answer"),
    "Did you mean the next morning or a different end time?",
  );
  await user.type(screen.getByLabelText("Reviewer name"), "Test Reviewer");
  await user.type(
    screen.getByLabelText("Review rationale and sources"),
    "Checked the original message and removed identifiers.",
  );
  await user.click(screen.getByRole("checkbox", { name: /Facts checked/ }));
  expect(approve).toBeDisabled();
  await user.click(
    screen.getByRole("checkbox", { name: /Personal information reviewed/ }),
  );
  await user.click(approve);
  await screen.findByText("Review saved. No model was trained automatically.");
  await waitFor(() => expect(calls).toHaveLength(1));
  expect(calls[0].corrected_answer).toBe(
    "Did you mean the next morning or a different end time?",
  );
  expect(calls[0].source_checked).toBe(true);
  expect(calls[0].privacy_checked).toBe(true);
  expect(calls[0].expected_version).toBe(1);
  expect(JSON.stringify(localStorage)).not.toContain("test-review-key");
  expect(JSON.stringify(sessionStorage)).not.toContain("test-review-key");
});

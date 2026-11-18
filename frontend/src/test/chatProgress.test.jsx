import { act, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import ChatProgress from "../components/ChatProgress";

vi.mock("../hooks/useLanguage", () => ({
  useLanguage: () => ({ t: (text) => text }),
}));

it("updates a long search and starts a fresh status once results arrive", () => {
  vi.useFakeTimers();
  try {
    const view = render(<ChatProgress key="search" phase="search" />);
    expect(screen.getByRole("status")).toHaveTextContent("กำลังอ่านคำถาม");
    act(() => vi.advanceTimersByTime(8000));
    expect(screen.getByRole("status")).toHaveTextContent("กำลังรอผลค้นหา");
    act(() => vi.advanceTimersByTime(16000));
    expect(screen.getByRole("status")).toHaveTextContent("ยังรอผลค้นหา");
    view.rerender(<ChatProgress key="explanation" phase="explanation" />);
    expect(screen.getByRole("status")).toHaveTextContent("ผลค้นหาพร้อมแล้ว");
    act(() => vi.advanceTimersByTime(8000));
    expect(screen.getByRole("status")).toHaveTextContent(
      "ระหว่างนี้เปิดดูรายวิชา",
    );
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  } finally {
    vi.useRealTimers();
  }
});

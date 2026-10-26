import { afterEach, expect, it, vi } from "vitest";
import { courseText, storedLanguage, translate } from "./translate";

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});
it("uses source-language data with a fallback for missing translations", () => {
  const course = {
    subject_name_th: "วิชาภาษาไทย",
    subject_name_en: "English course",
    subject_desc_th: "คำอธิบาย",
  };
  expect(courseText(course, "name", "th")).toBe("วิชาภาษาไทย");
  expect(courseText(course, "name", "en")).toBe("English course");
  expect(courseText(course, "description", "en")).toBe("คำอธิบาย");
});
it("defaults safely for unsupported settings or unavailable storage", () => {
  localStorage.setItem("ku-language", "fr");
  expect(storedLanguage()).toBe("en");
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  expect(storedLanguage()).toBe("en");
});
it("translates dynamic feedback and preserves unknown source values", () => {
  expect(translate("เพิ่ม 001 หมู่ 1 ลงตารางแล้ว", "en")).toBe(
    "Added 001 section 1 to your timetable",
  );
  expect(translate("Section 001 has no complete schedule.", "th")).toBe(
    "หมู่ 001 ไม่มีเวลาเรียนที่ครบถ้วน",
  );
  expect(translate("  credits", "th")).toBe("  หน่วยกิต");
  expect(translate("An actual course title", "th")).toBe(
    "An actual course title",
  );
});

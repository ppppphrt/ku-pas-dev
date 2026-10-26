import { messages } from "./messages";

export const LANGUAGE_KEY = "ku-language";
export const languages = ["en", "th"];
const dictionary = new Map();
for (const [en, th] of messages) {
  dictionary.set(en, { en, th });
  dictionary.set(th, { en, th });
}
export function translate(value, language = "en", params = {}) {
  if (value == null) return "";
  const original = String(value);
  const key = original.replace(/\s+/g, " ").trim();
  let result = dictionary.get(key)?.[language] ?? key;
  const dynamic = [
    [
      /^Section (.+) has no complete schedule\.$/,
      "Section {id} has no complete schedule.",
      "หมู่ {id} ไม่มีเวลาเรียนที่ครบถ้วน",
    ],
    [
      /^Course (.+) has unknown credits\.$/,
      "Course {id} has unknown credits.",
      "วิชา {id} ไม่มีข้อมูลหน่วยกิต",
    ],
    [
      /^Course (.+) is not in this catalog\.$/,
      "Course {id} is not in this catalog.",
      "ไม่พบวิชา {id} ในชุดข้อมูลนี้",
    ],
    [
      /^เพิ่ม (.+) หมู่ (.+) ลงตารางแล้ว$/,
      "Added {id} section {section} to your timetable",
      "เพิ่ม {id} หมู่ {section} ลงตารางแล้ว",
    ],
    [
      /^พบ (\d+) รายวิชาตามเงื่อนไข แสดงสูงสุด 8 วิชา โดยเรียงหมู่ที่วางในตารางได้ก่อน$/,
      "Found {id} matching courses. Showing up to 8, with plannable sections first.",
      "พบ {id} รายวิชาตามเงื่อนไข แสดงสูงสุด 8 วิชา โดยเรียงหมู่ที่วางในตารางได้ก่อน",
    ],
  ];
  for (const [pattern, en, th] of dynamic) {
    const match = key.match(pattern);
    if (match) {
      result = (language === "th" ? th : en)
        .replace("{id}", match[1])
        .replace("{section}", match[2] ?? "");
      break;
    }
  }
  result = result.replace(/\{(\w+)\}/g, (match, key) =>
    params[key] == null ? match : String(params[key]),
  );
  return (
    (original.match(/^\s+/)?.[0] || "") +
    result +
    (original.match(/\s+$/)?.[0] || "")
  );
}
export function courseText(course, kind, language) {
  const prefix = kind === "name" ? "subject_name_" : "subject_desc_";
  return (
    course?.[prefix + language] ||
    course?.[prefix + (language === "th" ? "en" : "th")] ||
    ""
  );
}
export function storedLanguage() {
  try {
    const value = localStorage.getItem(LANGUAGE_KEY);
    return languages.includes(value) ? value : "en";
  } catch {
    return "en";
  }
}

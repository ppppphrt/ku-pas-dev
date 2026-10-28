import { useLanguage } from "../hooks/useLanguage";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api, errorMessage } from "../services/courseApi";
import { useTimetable } from "../hooks/useTimetable";
const groups = [
  "ภาษากับการสื่อสาร",
  "อยู่ดีมีสุข",
  "ศาสตร์แห่งผู้ประกอบการ",
  "พลเมืองไทยและพลเมืองโลก",
  "สุนทรียศาสตร์",
];
const competencies = [
  "การสื่อสารและสารสนเทศ",
  "ภาวะผู้นำ",
  "การเป็นผู้ประกอบการ",
  "ทักษะการคิด",
  "พหุวัฒนธรรม",
  "การจัดการตนเอง",
  "การเรียนรู้ตลอดชีวิต",
  "ความเป็นพลเมือง",
];
const days = {
  Mon: "จันทร์",
  Tue: "อังคาร",
  Wed: "พุธ",
  Thu: "พฤหัสบดี",
  Fri: "ศุกร์",
  Sat: "เสาร์",
  Sun: "อาทิตย์",
};
const initial = {
  interest: "",
  curriculum: null,
  group: null,
  competency: null,
  program: null,
  days: [],
  start_time: null,
  end_time: null,
};
const examples = [
  "สนใจภาษา",
  "สมรรถนะ 67 ด้าน 4",
  "ว่างวันศุกร์ 09:00-16:00",
  "ค้นหา 01001317",
];
function SourceLink({ url, children }) {
  return /^https?:\/\//.test(url || "") ? (
    <a href={url} target="_blank" rel="noreferrer">
      {children}
    </a>
  ) : (
    <span>{children}</span>
  );
}
export default function ChatPage() {
  const { t, language } = useLanguage();
  const timetable = useTimetable();
  const [message, setMessage] = useState("");
  const [state, setState] = useState(initial);
  const [messages, setMessages] = useState([]);
  const [response, setResponse] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const pending = useRef(false);
  const resultsHeading = useRef(null);
  function showResults() {
    const heading = resultsHeading.current;
    if (!heading) return;
    heading.focus({ preventScroll: true });
    heading.scrollIntoView?.({
      behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
      block: "start",
    });
  }
  useEffect(() => {
    if (response) showResults();
  }, [response]);

  async function send(text = message, displayText = text) {
    if (!text.trim() || pending.current || !timetable.ready) return;
    pending.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const { data } = await api.post("/chat", {
        message: text,
        state,
        dataset_version: timetable.metadata.dataset_version,
        items: timetable.items.map(({ course, section }) => ({
          subject_code: course.subject_code,
          section_id: section.section_id,
        })),
      });
      setMessages((old) => [
        ...old.slice(-18),
        {
          role: "user",
          text: displayText,
        },
        {
          role: "assistant",
          text: data.message,
        },
      ]);
      setResponse(data);
      setState(data.state);
      setMessage("");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  function update(key, value) {
    setState((old) => ({
      ...old,
      [key]: value,
    }));
  }
  return (
    <main id="main" className="container chat-page" lang={language}>
      <header className="chat-heading">
        <div>
          <p className="eyebrow">{t("GENED REGIS · บางเขน")}</p>
          <h1>{t("คุยเพื่อหาวิชาที่ใช่")}</h1>
          <p>{t("บอกความสนใจและเวลาว่าง แล้วเลือกหมู่เรียนใส่ตารางของคุณ")}</p>
        </div>
        <Link to="/timetable">
          {t("ดูตารางของฉัน · ")}
          {timetable.items.length}
          {t(" วิชา →")}
        </Link>
      </header>
      <div className="chat-layout">
        <aside className="chat-sidebar">
          <h2>{t("เงื่อนไขที่คุยกัน")}</h2>
          <p>{t("พิมพ์เปลี่ยนในแชท หรือปรับตรงนี้แล้วกดค้นหา")}</p>
          <label>
            {t("ความสนใจ / รหัสวิชา")}
            <input
              value={state.interest}
              maxLength={200}
              onChange={(e) => update("interest", e.target.value)}
            />
          </label>
          <label>
            {t("รูปแบบ GE")}
            <select
              value={state.curriculum || ""}
              onChange={(e) =>
                setState((old) => ({
                  ...old,
                  curriculum: e.target.value || null,
                  group: null,
                  competency: null,
                }))
              }
            >
              <option value="">{t("ทั้งหมดในชุดทดลอง")}</option>
              <option value="64">{t("กลุ่มสาระ 64")}</option>
              <option value="67">{t("สมรรถนะ 67")}</option>
            </select>
          </label>
          {state.curriculum === "64" && (
            <label>
              {t("กลุ่มสาระ")}
              <select
                value={state.group || ""}
                onChange={(e) => update("group", e.target.value || null)}
              >
                <option value="">{t("ทุกกลุ่ม")}</option>
                {groups.map((g) => (
                  <option key={g} value={g}>
                    {t(g)}
                  </option>
                ))}
              </select>
            </label>
          )}
          {state.curriculum === "67" && (
            <label>
              {t("สมรรถนะ")}
              <select
                value={state.competency || ""}
                onChange={(e) =>
                  update("competency", Number(e.target.value) || null)
                }
              >
                <option value="">{t("ทุกสมรรถนะ")}</option>
                {competencies.map((name, i) => (
                  <option key={t(name)} value={i + 1}>
                    {i + 1} · {t(name)}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            {t("ประเภทนิสิต")}
            <select
              value={state.program || ""}
              onChange={(e) => update("program", e.target.value || null)}
            >
              <option value="">{t("ยังไม่ระบุ")}</option>
              <option value="regular">{t("ภาคปกติ")}</option>
              <option value="special">{t("ภาคพิเศษ")}</option>
            </select>
          </label>
          <fieldset>
            <legend>{t("วันที่ว่าง (ทุกคาบต้องอยู่ในวันที่เลือก)")}</legend>
            <div className="chat-days">
              {Object.entries(days).map(([code, name]) => (
                <label key={code}>
                  <input
                    type="checkbox"
                    checked={state.days.includes(code)}
                    onChange={(e) =>
                      update(
                        "days",
                        e.target.checked
                          ? [...state.days, code]
                          : state.days.filter((d) => d !== code),
                      )
                    }
                  />
                  {t(name)}
                </label>
              ))}
            </div>
            <small>{t("ไม่เลือก = ทุกวัน")}</small>
          </fieldset>
          <div className="chat-times">
            <label>
              {t("เริ่ม")}
              <input
                type="time"
                value={state.start_time || ""}
                onChange={(e) => update("start_time", e.target.value || null)}
              />
            </label>
            <label>
              {t("สิ้นสุด")}
              <input
                type="time"
                value={state.end_time || ""}
                onChange={(e) => update("end_time", e.target.value || null)}
              />
            </label>
          </div>
          <button
            className="primary"
            disabled={busy || !timetable.ready}
            onClick={() => send("แนะนำวิชาตามเงื่อนไข")}
          >
            {t("ค้นหาตามเงื่อนไข")}
          </button>
          <button
            disabled={busy}
            onClick={() => {
              setState(initial);
              setResponse(null);
              setMessages([]);
              setError("");
              setNotice("");
            }}
          >
            {t("เริ่มบทสนทนาใหม่")}
          </button>
          <p className="hint">
            {t(
              "กลุ่มสาระและสมรรถนะในชุดนี้เป็นข้อมูลจำลอง ไม่ใช่การรับรองว่าใช้แทนกันในหลักสูตรได้",
            )}
          </p>
        </aside>
        <section
          className="chat-conversation"
          aria-label={t("บทสนทนาค้นหา GE")}
        >
          <div className="chat-mode">
            <strong>
              {response?.engine === "ollama"
                ? t("AI บนเครื่อง · Ollama")
                : t("โหมดทดลองฟรี · ตัวช่วยแชทตามกฎ")}
            </strong>
            <span>
              {t("ไม่เรียก API แบบเสียเงิน · ยังไม่ยืนยันภาคเรียนปัจจุบัน")}
            </span>
          </div>
          {response && (
            <div className="chat-result-jump">
              <span role="status">
                {busy ? (
                  t("กำลังค้นหา…")
                ) : (
                  <>
                    <strong>{response.total_results}</strong>{" "}
                    {t("courses found")}
                  </>
                )}
              </span>
              <button type="button" onClick={showResults} disabled={busy}>
                {t("View results")} <span aria-hidden="true">↓</span>
              </button>
            </div>
          )}
          <div
            className="chat-transcript"
            role="log"
            aria-label={t("ข้อความสนทนา")}
            aria-live="polite"
          >
            <p className="chat-bubble assistant">
              {t(
                "สวัสดีครับ ลองบอกว่าอยากเรียนเกี่ยวกับอะไร แล้วค่อยถามต่อเรื่องวันและเวลาได้ เช่น “สนใจภาษา” ตามด้วย “เฉพาะวันศุกร์” ข้อมูลที่ขาดจะติดป้ายจำลอง และการเพิ่มตารางยังไม่ใช่การลงทะเบียนจริง",
              )}
            </p>
            {messages.map((entry, i) => (
              <p className={`chat-bubble ${entry.role}`} key={i}>
                {entry.role === "assistant" ? t(entry.text) : entry.text}
              </p>
            ))}
          </div>
          <div className="chat-examples">
            {examples.map((text) => (
              <button
                key={text}
                disabled={busy || !timetable.ready}
                onClick={() => send(text, t(text))}
              >
                {t(text)}
              </button>
            ))}
          </div>
          <form
            className="chat-compose"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <label htmlFor="chat-message">{t("ถามเรื่องรายวิชา GE")}</label>
            <div>
              <input
                id="chat-message"
                value={message}
                maxLength={1000}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t("เช่น สนใจธุรกิจ ว่างวันพุธ 09:00-16:00")}
                disabled={busy}
              />
              <button
                className="primary"
                disabled={busy || !message.trim() || !timetable.ready}
              >
                {busy ? t("กำลังค้นหา…") : t("ส่งข้อความ")}
              </button>
            </div>
          </form>
          {error && (
            <p className="error" role="alert">
              {t(error)}
              {t(" · ลองส่งคำถามอีกครั้ง")}
            </p>
          )}
          {notice && (
            <p className="notice" role="status">
              {t(notice)}
            </p>
          )}
          {response && (
            <section
              aria-label={t("ผลการค้นหาล่าสุด")}
              aria-busy={busy}
              className="chat-results"
            >
              <h2
                ref={resultsHeading}
                tabIndex={-1}
                className="chat-results-heading"
              >
                {t("ผลล่าสุด · ")}
                {response.total_results}
                {t(" วิชา")}
              </h2>
              {response.results.length === 0 && (
                <p className="empty">
                  {t(
                    "No courses found. Try changing your interests or filters.",
                  )}
                </p>
              )}
              <p className="warning">{t(response.notice)}</p>
              <p className="hint">
                {t("แหล่งข้อมูล:")}{" "}
                <SourceLink url={response.sources.catalog.source_url}>
                  {t("KU Drive snapshot")}
                </SourceLink>{" "}
                {t("· อัปเดต ")}
                {response.sources.catalog.updated_at || t("ไม่ทราบ")}
                <br />
                {t("GE/การเปิดสอน:")}{" "}
                <SourceLink url={response.sources.ge.source_url}>
                  {response.sources.ge.source_url}
                </SourceLink>{" "}
                {t("· อัปเดต ")}
                {response.sources.ge.updated_at}
                {t(" · ภาคเรียน:")}{" "}
                {response.sources.ge.academic_year &&
                response.sources.ge.semester
                  ? `${response.sources.ge.semester}/${response.sources.ge.academic_year}`
                  : t("รอยืนยัน")}
              </p>
              {response.results.map((result) => (
                <ChatCourse
                  key={result.course.subject_code}
                  result={result}
                  timetable={timetable}
                  busy={busy}
                  onAdded={(course, section) =>
                    setNotice(
                      `เพิ่ม ${course.subject_code} หมู่ ${section.section_code} ลงตารางแล้ว`,
                    )
                  }
                />
              ))}
            </section>
          )}
        </section>
      </div>
    </main>
  );
}
function ChatCourse({ result, timetable, busy, onAdded }) {
  const { t, courseText } = useLanguage();
  const { course, classification, sections } = result;
  const added = timetable.items.some(
    (item) => item.course.subject_code === course.subject_code,
  );
  return (
    <article className="chat-course">
      <div className="chat-course-title">
        <span>
          {course.subject_code} · {course.credits ?? "?"}
          {t(" หน่วยกิต")}
        </span>
        <span
          className={classification.status === "mock" ? "chat-mock" : "badge"}
        >
          {t("GE ")}
          {classification.status === "mock" ? t("จำลอง") : t("จาก export")}
        </span>
      </div>
      <h3>
        <Link to={`/courses/${encodeURIComponent(course.subject_code)}`}>
          {courseText(course, "name")}
        </Link>
      </h3>
      <p lang="en">
        {course.subject_name_en !== courseText(course, "name")
          ? course.subject_name_en
          : null}
      </p>
      <p className="hint">
        {t("กลุ่มสาระ 64: ")}
        {classification.groups.map((group) => t(group)).join(", ") ||
          t("ไม่ทราบ")}
        {t(" · สมรรถนะ 67: ")}
        {classification.competencies.join(", ") || t("ไม่ทราบ")}
      </p>
      <p className="chat-description">
        {courseText(course, "description") || t("No description available.")}
      </p>
      <details>
        <summary>
          {t("ดูหมู่และเวลาเรียน · ")}
          {sections.length}
          {t(" หมู่ตรงเงื่อนไข")}
        </summary>
        {!sections.length && (
          <p>
            {t(
              "ไม่พบหมู่เรียนใน snapshot ที่ตรงเงื่อนไข ยังสรุปว่าไม่เปิดสอนจริงไม่ได้",
            )}
          </p>
        )}
        {sections.map(
          ({
            section,
            offering,
            snapshot_remaining,
            eligibility,
            conflicts,
            can_plan,
          }) => (
            <div className="chat-section" key={section.section_id}>
              <strong>
                {t("หมู่ ")}
                {section.section_code}
              </strong>
              <div>
                {section.time_slots.map((slot, i) => (
                  <span className="slot" key={i}>
                    {t(days[slot.day])} {slot.start}–{slot.end} ·{" "}
                    {slot.location || t("ไม่ระบุห้อง")}
                  </span>
                ))}
              </div>
              {!section.schedule_complete && (
                <p className="warning">
                  {t("เวลาเรียนไม่ครบ · ")}
                  {t(section.schedule_note)}
                </p>
              )}
              <p>
                {t("ที่นั่งจาก snapshot: ")}
                {snapshot_remaining ?? t("ไม่ทราบ")}
                {t(" · ลงแล้ว")} {section.total_registered ?? "?"}/
                {section.total_seat ?? "?"} {t("(ไม่ใช่จำนวนปัจจุบัน)")}
              </p>
              <p>
                <span
                  className={
                    offering?.status === "mock" ? "chat-mock" : "badge"
                  }
                >
                  {offering?.status === "mock"
                    ? t("สถานะจำลอง")
                    : t("สถานะจาก export / ยังขาดข้อมูล")}
                </span>{" "}
                {offering?.offered === true
                  ? t("เปิดสอน")
                  : offering?.offered === false
                    ? t("ไม่เปิดสอน")
                    : t("ยังยืนยันการเปิดสอนไม่ได้")}{" "}
                {t("· เหลือ ")}
                {offering?.remaining ?? t("ไม่ทราบ")}
                {t(" ที่นั่ง")}
              </p>
              <p>
                {t("ประเภทภาค:")}{" "}
                {offering?.programs
                  .map((p) => (p === "regular" ? t("Regular") : t("Special")))
                  .join(", ") || t("ไม่ทราบ")}{" "}
                ·{" "}
                {eligibility === "program_mismatch"
                  ? t("ประเภทภาคไม่ตรงเงื่อนไข")
                  : eligibility === "program_matches"
                    ? t("ประเภทภาคตรง แต่ยังยืนยันสิทธิ์รายบุคคลไม่ได้")
                    : t("ยังยืนยันสิทธิ์ไม่ได้")}
              </p>
              <p className="hint">
                {t(offering?.eligibility_note) ||
                  t("ยังไม่มีข้อมูลเงื่อนไขลงทะเบียน")}
              </p>
              {conflicts && (
                <p className="warning">{t("เวลาชนกับตารางปัจจุบัน")}</p>
              )}
              <button
                disabled={
                  busy ||
                  timetable.busy ||
                  !timetable.ready ||
                  added ||
                  !can_plan
                }
                onClick={async () => {
                  if (await timetable.add(course, section))
                    onAdded(course, section);
                }}
              >
                {added ? t("อยู่ในตารางแล้ว") : t("เพิ่มหมู่นี้ลงตาราง")}
              </button>
            </div>
          ),
        )}
      </details>
    </article>
  );
}

import { useRef, useState } from "react";
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
  const timetable = useTimetable();
  const [message, setMessage] = useState("");
  const [state, setState] = useState(initial);
  const [messages, setMessages] = useState([]);
  const [response, setResponse] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const pending = useRef(false);

  async function send(text = message) {
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
        { role: "user", text },
        { role: "assistant", text: data.message },
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
    setState((old) => ({ ...old, [key]: value }));
  }

  return (
    <main id="main" className="container chat-page" lang="th">
      <header className="chat-heading">
        <div>
          <p className="eyebrow">GENED REGIS · บางเขน</p>
          <h1>คุยเพื่อหาวิชาที่ใช่</h1>
          <p>บอกความสนใจและเวลาว่าง แล้วเลือกหมู่เรียนใส่ตารางของคุณ</p>
        </div>
        <Link to="/timetable">
          ดูตารางของฉัน · {timetable.items.length} วิชา →
        </Link>
      </header>
      <div className="chat-layout">
        <aside className="chat-sidebar">
          <h2>เงื่อนไขที่คุยกัน</h2>
          <p>พิมพ์เปลี่ยนในแชท หรือปรับตรงนี้แล้วกดค้นหา</p>
          <label>
            ความสนใจ / รหัสวิชา
            <input
              value={state.interest}
              maxLength={200}
              onChange={(e) => update("interest", e.target.value)}
            />
          </label>
          <label>
            รูปแบบ GE
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
              <option value="">ทั้งหมดในชุดทดลอง</option>
              <option value="64">กลุ่มสาระ 64</option>
              <option value="67">สมรรถนะ 67</option>
            </select>
          </label>
          {state.curriculum === "64" && (
            <label>
              กลุ่มสาระ
              <select
                value={state.group || ""}
                onChange={(e) => update("group", e.target.value || null)}
              >
                <option value="">ทุกกลุ่ม</option>
                {groups.map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </select>
            </label>
          )}
          {state.curriculum === "67" && (
            <label>
              สมรรถนะ
              <select
                value={state.competency || ""}
                onChange={(e) =>
                  update("competency", Number(e.target.value) || null)
                }
              >
                <option value="">ทุกสมรรถนะ</option>
                {competencies.map((name, i) => (
                  <option key={name} value={i + 1}>
                    {i + 1} · {name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            ประเภทนิสิต
            <select
              value={state.program || ""}
              onChange={(e) => update("program", e.target.value || null)}
            >
              <option value="">ยังไม่ระบุ</option>
              <option value="regular">ภาคปกติ</option>
              <option value="special">ภาคพิเศษ</option>
            </select>
          </label>
          <fieldset>
            <legend>วันที่ว่าง (ทุกคาบต้องอยู่ในวันที่เลือก)</legend>
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
                  {name}
                </label>
              ))}
            </div>
            <small>ไม่เลือก = ทุกวัน</small>
          </fieldset>
          <div className="chat-times">
            <label>
              เริ่ม
              <input
                type="time"
                value={state.start_time || ""}
                onChange={(e) => update("start_time", e.target.value || null)}
              />
            </label>
            <label>
              สิ้นสุด
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
            ค้นหาตามเงื่อนไข
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
            เริ่มบทสนทนาใหม่
          </button>
          <p className="hint">
            กลุ่มสาระและสมรรถนะในชุดนี้เป็นข้อมูลจำลอง
            ไม่ใช่การรับรองว่าใช้แทนกันในหลักสูตรได้
          </p>
        </aside>
        <section className="chat-conversation" aria-label="บทสนทนาค้นหา GE">
          <div className="chat-mode">
            <strong>
              {response?.engine === "ollama"
                ? "AI บนเครื่อง · Ollama"
                : "โหมดทดลองฟรี · ตัวช่วยแชทตามกฎ"}
            </strong>
            <span>ไม่เรียก API แบบเสียเงิน · ยังไม่ยืนยันภาคเรียนปัจจุบัน</span>
          </div>
          <div
            className="chat-transcript"
            role="log"
            aria-label="ข้อความสนทนา"
            aria-live="polite"
          >
            <p className="chat-bubble assistant">
              สวัสดีครับ ลองบอกว่าอยากเรียนเกี่ยวกับอะไร
              แล้วค่อยถามต่อเรื่องวันและเวลาได้ เช่น “สนใจภาษา” ตามด้วย
              “เฉพาะวันศุกร์” ข้อมูลที่ขาดจะติดป้ายจำลอง
              และการเพิ่มตารางยังไม่ใช่การลงทะเบียนจริง
            </p>
            {messages.map((entry, i) => (
              <p className={`chat-bubble ${entry.role}`} key={i}>
                {entry.text}
              </p>
            ))}
          </div>
          <div className="chat-examples">
            {examples.map((text) => (
              <button
                key={text}
                disabled={busy || !timetable.ready}
                onClick={() => send(text)}
              >
                {text}
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
            <label htmlFor="chat-message">ถามเรื่องรายวิชา GE</label>
            <div>
              <input
                id="chat-message"
                value={message}
                maxLength={1000}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="เช่น สนใจธุรกิจ ว่างวันพุธ 09:00-16:00"
                disabled={busy}
              />
              <button
                className="primary"
                disabled={busy || !message.trim() || !timetable.ready}
              >
                {busy ? "กำลังค้นหา…" : "ส่งข้อความ"}
              </button>
            </div>
          </form>
          {error && (
            <p className="error" role="alert">
              {error} · ลองส่งคำถามอีกครั้ง
            </p>
          )}
          {notice && (
            <p className="notice" role="status">
              {notice}
            </p>
          )}
          {response && (
            <section
              aria-label="ผลการค้นหาล่าสุด"
              aria-busy={busy}
              className="chat-results"
            >
              <p className="warning">{response.notice}</p>
              <p className="hint">
                แหล่งข้อมูล:{" "}
                <SourceLink url={response.sources.catalog.source_url}>
                  KU Drive snapshot
                </SourceLink>{" "}
                · อัปเดต {response.sources.catalog.updated_at || "ไม่ทราบ"}
                <br />
                GE/การเปิดสอน:{" "}
                <SourceLink url={response.sources.ge.source_url}>
                  {response.sources.ge.source_url}
                </SourceLink>{" "}
                · อัปเดต {response.sources.ge.updated_at} · ภาคเรียน:{" "}
                {response.sources.ge.academic_year &&
                response.sources.ge.semester
                  ? `${response.sources.ge.semester}/${response.sources.ge.academic_year}`
                  : "รอยืนยัน"}
              </p>
              <h2>ผลล่าสุด · {response.total_results} วิชา</h2>
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
  const { course, classification, sections } = result;
  const added = timetable.items.some(
    (item) => item.course.subject_code === course.subject_code,
  );
  return (
    <article className="chat-course">
      <div className="chat-course-title">
        <span>
          {course.subject_code} · {course.credits ?? "?"} หน่วยกิต
        </span>
        <span
          className={classification.status === "mock" ? "chat-mock" : "badge"}
        >
          GE {classification.status === "mock" ? "จำลอง" : "จาก export"}
        </span>
      </div>
      <h3>
        <Link to={`/courses/${encodeURIComponent(course.subject_code)}`}>
          {course.subject_name_th || course.subject_name_en}
        </Link>
      </h3>
      <p>{course.subject_name_en}</p>
      <p className="hint">
        กลุ่มสาระ 64: {classification.groups.join(", ") || "ไม่ทราบ"} · สมรรถนะ
        67: {classification.competencies.join(", ") || "ไม่ทราบ"}
      </p>
      <p className="chat-description">
        {course.subject_desc_th || "ไม่มีคำอธิบายรายวิชา"}
      </p>
      <details>
        <summary>
          ดูหมู่และเวลาเรียน · {sections.length} หมู่ตรงเงื่อนไข
        </summary>
        {!sections.length && (
          <p>
            ไม่พบหมู่เรียนใน snapshot ที่ตรงเงื่อนไข
            ยังสรุปว่าไม่เปิดสอนจริงไม่ได้
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
              <strong>หมู่ {section.section_code}</strong>
              <div>
                {section.time_slots.map((slot, i) => (
                  <span className="slot" key={i}>
                    {days[slot.day]} {slot.start}–{slot.end} ·{" "}
                    {slot.location || "ไม่ระบุห้อง"}
                  </span>
                ))}
              </div>
              {!section.schedule_complete && (
                <p className="warning">
                  เวลาเรียนไม่ครบ · {section.schedule_note}
                </p>
              )}
              <p>
                ที่นั่งจาก snapshot: {snapshot_remaining ?? "ไม่ทราบ"} · ลงแล้ว{" "}
                {section.total_registered ?? "?"}/{section.total_seat ?? "?"}{" "}
                (ไม่ใช่จำนวนปัจจุบัน)
              </p>
              <p>
                <span
                  className={
                    offering?.status === "mock" ? "chat-mock" : "badge"
                  }
                >
                  {offering?.status === "mock"
                    ? "สถานะจำลอง"
                    : "สถานะจาก export / ยังขาดข้อมูล"}
                </span>{" "}
                {offering?.offered === true
                  ? "เปิดสอน"
                  : offering?.offered === false
                    ? "ไม่เปิดสอน"
                    : "ยังยืนยันการเปิดสอนไม่ได้"}{" "}
                · เหลือ {offering?.remaining ?? "ไม่ทราบ"} ที่นั่ง
              </p>
              <p>
                ประเภทภาค:{" "}
                {offering?.programs
                  .map((p) => (p === "regular" ? "ปกติ" : "พิเศษ"))
                  .join(", ") || "ไม่ทราบ"}{" "}
                ·{" "}
                {eligibility === "program_mismatch"
                  ? "ประเภทภาคไม่ตรงเงื่อนไข"
                  : eligibility === "program_matches"
                    ? "ประเภทภาคตรง แต่ยังยืนยันสิทธิ์รายบุคคลไม่ได้"
                    : "ยังยืนยันสิทธิ์ไม่ได้"}
              </p>
              <p className="hint">
                {offering?.eligibility_note ||
                  "ยังไม่มีข้อมูลเงื่อนไขลงทะเบียน"}
              </p>
              {conflicts && <p className="warning">เวลาชนกับตารางปัจจุบัน</p>}
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
                {added ? "อยู่ในตารางแล้ว" : "เพิ่มหมู่นี้ลงตาราง"}
              </button>
            </div>
          ),
        )}
      </details>
    </article>
  );
}

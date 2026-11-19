import ChatProgress from "../components/ChatProgress";
import TimetableRecommendations from "../components/TimetableRecommendations";
import Icon from "../components/Icon";
import ChatFeedback from "../components/ChatFeedback";
import { useLanguage } from "../hooks/useLanguage";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import PlanningHome from "../components/PlanningHome";
import RequiredCourses from "../components/RequiredCourses";
import { DAYS } from "../utils/timetable";
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
  verified_ge_only: false,
  curriculum: null,
  group: null,
  competency: null,
  program: null,
  days: [],
  start_time: null,
  end_time: null,
};
const starters = [
  {
    id: "interest",
    example: "สนใจภาษา",
    icon: "chat",
    title: "หาวิชาที่ตรงใจ",
    description: "เริ่มจากสิ่งที่คุณสนใจ",
    prompt:
      "บอกความสนใจมาได้เลยครับ ชอบเรียนเรื่องไหน หรือเวลาว่างชอบทำอะไร? เช่น ทำสวน ถ่ายรูป หรือฝึกภาษาจีน เดี๋ยวผมช่วยหาวิชาที่ตรงใจให้",
  },
  {
    id: "ge",
    example: "สมรรถนะ 67 ด้าน 4",
    icon: "book",
    title: "เก็บวิชา GE ให้ครบ",
    description: "ค้นหาตามกลุ่มหรือสมรรถนะ",
    prompt:
      "กำลังเก็บ GE ตามหลักสูตรปีไหน และอยากเก็บกลุ่มสาระหรือสมรรถนะด้านไหนครับ? เช่น “หลักสูตร 67 สมรรถนะด้าน 4” หรือ “กลุ่มสาระ 64 อยู่ดีมีสุข” ถ้าไม่แน่ใจ บอกปีหลักสูตรก่อนได้ครับ",
  },
  {
    id: "time",
    example: "ว่างวันศุกร์ 09:00-16:00",
    icon: "calendar",
    title: "หาวิชาในเวลาว่าง",
    description: "ให้เวลาเรียนเข้ากับชีวิตคุณ",
    prompt:
      "สะดวกเรียนวันไหนและช่วงกี่โมงครับ? เช่น “ว่างวันศุกร์ 09:00-16:00” ถ้ามีหัวข้อที่สนใจ บอกเพิ่มได้เลยครับ",
  },
  {
    id: "course",
    example: "ค้นหา 01001317",
    icon: "search",
    title: "มีวิชาในใจแล้ว",
    description: "ค้นหาด้วยชื่อหรือรหัสวิชา",
    prompt:
      "ส่งชื่อวิชาภาษาไทย ภาษาอังกฤษ หรือรหัสวิชามาได้เลยครับ ถ้ารู้แค่บางส่วนของชื่อก็พิมพ์มาได้",
  },
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
  const { pathname, search } = useLocation();
  const mode = new URLSearchParams(search).get("ge");
  const geMode = mode === "fit" || mode === "browse" ? mode : null;
  const [planning, setPlanning] = useState(false);
  const geQuery = geMode ? `&ge_mode=${geMode}` : "";
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [state, setState] = useState(initial);
  const [starter, setStarter] = useState(null);
  const [messages, setMessages] = useState([]);
  const [conversationId, setConversationId] = useState(() =>
    crypto.randomUUID(),
  );
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
  const transcriptEnd = useRef(null);
  const messageInput = useRef(null);
  useEffect(() => {
    transcriptEnd.current?.scrollIntoView?.({ block: "nearest" });
    if (messages.length) messageInput.current?.focus();
  }, [messages]);

  function begin(choice) {
    setStarter(choice);
    setMessages([
      { role: "user", id: crypto.randomUUID(), text: t(choice.title) },
      { role: "assistant", id: crypto.randomUUID(), text: t(choice.prompt) },
    ]);
  }

  async function send(text = message, displayText = text) {
    if (
      !text.trim() ||
      pending.current ||
      !timetable.ready ||
      (geMode === "fit" && !timetable.items.length)
    )
      return;
    pending.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    setResponse(null);
    const lastTurn = messages.at(-1);
    const retry = lastTurn?.failed && lastTurn.text === displayText;
    const userTurn = {
      role: "user",
      id: retry ? lastTurn.id : crypto.randomUUID(),
      text: displayText,
    };
    setMessages((old) =>
      retry
        ? old.map((entry) => (entry.id === userTurn.id ? userTurn : entry))
        : [...old.slice(-18), userTurn],
    );
    setMessage("");
    const reply = text.trim();
    const geNumber = starter?.id === "ge" && /^[1-8]$/.test(reply);
    const geName =
      starter?.id === "ge" &&
      [...groups, ...competencies].find((name) =>
        [name, t(name)].some(
          (label) => label.toLowerCase() === reply.toLowerCase(),
        ),
      );
    let searchText = geNumber ? `สมรรถนะ 67 ด้าน ${reply}` : geName || text;
    if (starter?.id === "ge" && /^(?:25)?(?:64|67)$/.test(reply))
      searchText = `หลักสูตร ${reply}`;
    if (
      starter?.id === "interest" &&
      !/สนใจ|อยาก|interested|\b(search|find|want)\b/i.test(text)
    )
      searchText = `สนใจ ${reply}`;
    if (
      starter?.id === "course" &&
      !/^(ค้นหา|ขอดู|find\b|search\b)/i.test(reply)
    )
      searchText = `ค้นหา ${reply}`;

    let answerShown = false;
    try {
      const requestBody = {
        message: searchText.length <= 1000 ? searchText : text,
        conversation_id: conversationId,
        language,
        history: messages
          .filter((entry) => !entry.failed)
          .slice(-12)
          .map(({ role, text }) => ({
            role,
            content: text.slice(0, 5000),
          })),
        state,
        dataset_version: timetable.metadata.dataset_version,
        items: timetable.items.map(({ course, section }) => ({
          subject_code: course.subject_code,
          section_id: section.section_id,
        })),
      };
      const { data } = await api.post(
        `/chat?quick=true${geQuery}`,
        requestBody,
        // LLM stages/retries share 48s; allow for retrieval, cold starts and network overhead.
        { timeout: 65000 },
      );
      const assistantId = crypto.randomUUID();
      setMessages((old) => [
        ...old,
        {
          role: "assistant",
          id: assistantId,
          text: data.message,
          feedbackReceipt: data.feedback_receipt,
        },
      ]);
      setResponse(data);
      setState(data.state);
      answerShown = true;
      setStarter(null);
      if (data.answer_pending) {
        const { data: finalAnswer } = await api.post(
          geMode ? `/chat?ge_mode=${geMode}` : "/chat",
          requestBody,
          {
            timeout: 65000,
          },
        );
        setMessages((old) =>
          old.map((entry) =>
            entry.id === assistantId
              ? {
                  ...entry,
                  text: finalAnswer.message,
                  feedbackReceipt: finalAnswer.feedback_receipt,
                }
              : entry,
          ),
        );
        setResponse(finalAnswer);
        setState(finalAnswer.state);
      }
    } catch (e) {
      if (answerShown) {
        setResponse((old) => ({ ...old, answer_pending: false }));
      } else {
        setMessages((old) =>
          old.map((entry) =>
            entry.id === userTurn.id ? { ...entry, failed: true } : entry,
          ),
        );
        setMessage(text);
      }
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
  if (planning && pathname === "/")
    return (
      <RequiredCourses
        timetable={timetable}
        onBack={() => setPlanning(false)}
      />
    );

  if (pathname === "/")
    return <PlanningHome onPlan={() => setPlanning(true)} />;

  if (geMode === "fit" && timetable.ready && !timetable.items.length)
    return (
      <main id="main" className="container">
        <h1>{t("Find GE around your timetable")}</h1>
        <p>
          {t("Add your existing sections before searching for GE that fits.")}
        </p>
        <Link to="/timetable?find-ge=1">{t("Timetable Planner")}</Link>
      </main>
    );

  return (
    <main
      id="main"
      className={`container chat-page ${messages.length ? "chat-active" : "chat-welcome"}`}
      lang={language}
    >
      <header className="chat-toolbar">
        <div className="chat-identity">
          <Icon name="chat" />
          <strong>Chat GE</strong>
          <span>{t("ผู้ช่วยค้นหารายวิชา")}</span>
        </div>
        <div className="chat-tools">
          <button
            type="button"
            aria-expanded={filtersOpen}
            aria-controls="chat-filters"
            onClick={() => setFiltersOpen((open) => !open)}
          >
            <Icon name="filter" />
            {t("เงื่อนไขการค้นหา")}
          </button>
          <Link to="/timetable">
            <Icon name="calendar" />
            {t("ตารางของฉัน")}
            <span className="chat-count">{timetable.items.length}</span>
          </Link>
        </div>
      </header>
      <div className={`chat-layout ${filtersOpen ? "chat-filters-open" : ""}`}>
        <aside id="chat-filters" className="chat-sidebar" hidden={!filtersOpen}>
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
            <input
              type="checkbox"
              checked={Boolean(state.verified_ge_only)}
              onChange={(e) => update("verified_ge_only", e.target.checked)}
            />
            {t("เฉพาะวิชาที่รับรอง GE แล้ว")}
          </label>
          <p className="hint">
            {t(
              "ค้นหาทุกรายวิชาใน catalog บางเขนเป็นค่าเริ่มต้น สถานะ GE แสดงแยกในแต่ละวิชา",
            )}
          </p>
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
              <option value="">{t("ไม่จำกัดกลุ่ม GE")}</option>
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
              setStarter(null);
              setConversationId(crypto.randomUUID());
              setError("");
              setNotice("");
            }}
          >
            {t("เริ่มบทสนทนาใหม่")}
          </button>
          <p className="hint">
            {t(
              "สมรรถนะ GE 67 อ้างอิงจาก gened.xlsx และข้อมูลที่ติดป้ายจำลองใช้สำหรับทดลอง",
            )}
          </p>
        </aside>
        <section
          className="chat-conversation"
          aria-label={t("บทสนทนาค้นหา GE")}
        >
          {!messages.length && (
            <div className="chat-intro">
              <div className="chat-avatar">
                <Icon name="book" />
                <span aria-hidden="true">✦</span>
              </div>
              {geMode && <Link to="/">{t("Back to choices")}</Link>}
              <h1>{t("วันนี้อยากเรียนรู้อะไร?")}</h1>
              <p>
                {t("หาวิชาที่ใช่ ในเวลาที่ชอบ")}
                <br />
                {t(
                  "เล่าความสนใจของคุณ แล้วให้ Chat GE ช่วยค้นหาและวางแผนตารางเรียน",
                )}
              </p>
            </div>
          )}
          {messages.length > 0 && (
            <div className="chat-session-heading">
              <h1>{t("คุยเพื่อหาวิชาที่ใช่")}</h1>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setState(initial);
                  setResponse(null);
                  setMessages([]);
                  setStarter(null);
                  setConversationId(crypto.randomUUID());
                  setMessage("");
                  setError("");
                  setNotice("");
                  messageInput.current?.focus();
                }}
              >
                {t("เริ่มบทสนทนาใหม่")}
              </button>
            </div>
          )}
          {response && !busy && (
            <p className="hint" role="status">
              {response.needs_clarification
                ? t("ขอรายละเอียดเพิ่มเติม")
                : response.engine === "ollama"
                  ? t("AI บนเครื่อง · Ollama")
                  : response.engine === "llm-api"
                    ? t("ผู้ช่วยแนะนำรายวิชา")
                    : response.engine === "local-rules-fast"
                      ? t("ค้นหาจากข้อมูลรายวิชา")
                      : response.engine === "local-rules-fallback"
                        ? t("LLM ไม่พร้อม · ใช้การค้นหาสำรอง")
                        : t("โหมดค้นหาตามกฎ · ยังไม่ได้เปิด LLM")}
            </p>
          )}
          {response?.search_context &&
            !response.needs_clarification &&
            !busy && (
              <p className="hint" role="status">
                {t("คำค้นปัจจุบัน:")}{" "}
                {response.search_context.interest || t("ทุกความสนใจ")}
                {" · "}
                {t(
                  response.search_context.scope === "verified-ge"
                    ? "เฉพาะวิชาที่รับรอง GE แล้ว"
                    : response.search_context.scope === "ge"
                      ? "GE records in Bangkhen"
                      : "catalog บางเขน",
                )}
                {" · "}
                {response.search_context.days
                  .map((day) => t(days[day]))
                  .join(", ") || t("ทุกวัน")}
                {" · "}
                {response.search_context.start_time || "00:00"}–
                {response.search_context.end_time || "24:00"}
              </p>
            )}
          {response && !response.needs_clarification && (
            <div className="chat-result-jump">
              <span role="status">
                {busy && !response.answer_pending ? (
                  t("กำลังค้นหา…")
                ) : (
                  <>
                    <strong>{response.total_results}</strong>{" "}
                    {t("courses found")}
                  </>
                )}
              </span>
              <button
                type="button"
                onClick={showResults}
                disabled={busy && !response.answer_pending}
              >
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
            {messages.map((entry, i) => (
              <div className={`chat-turn ${entry.role}`} key={entry.id || i}>
                <p className={`chat-bubble ${entry.role}`}>{entry.text}</p>
                {entry.role === "assistant" && (
                  <ChatFeedback receipt={entry.feedbackReceipt} />
                )}
              </div>
            ))}
            {busy && (
              <ChatProgress
                key={response?.answer_pending ? "explanation" : "search"}
                phase={response?.answer_pending ? "explanation" : "search"}
              />
            )}
            <div ref={transcriptEnd} />
          </div>
          {starter?.id === "ge" && !busy && (
            <div
              className="chat-competency-choices"
              role="group"
              aria-label={t("สมรรถนะ 67")}
            >
              {competencies.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => send(name, t(name))}
                >
                  {t(name)}
                </button>
              ))}
            </div>
          )}
          {!messages.length && geMode === "fit" && (
            <details className="chat-starters" open>
              <summary>
                {t("Free time in your saved timetable (08:00–20:00)")}
              </summary>
              <ul>
                {DAYS.map((day) => {
                  const slots = timetable.items
                    .flatMap(({ section }) => section.time_slots)
                    .filter((slot) => slot.day === day)
                    .sort((a, b) => a.start.localeCompare(b.start));
                  let cursor = "08:00";
                  const gaps = [];
                  for (const { start, end } of slots) {
                    if (start >= "20:00") break;
                    if (start > cursor) gaps.push(`${cursor}–${start}`);
                    if (end > cursor) cursor = end;
                  }
                  if (cursor < "20:00") gaps.push(`${cursor}–20:00`);
                  return (
                    <li key={day}>
                      {t(day)} ·{" "}
                      {gaps.length ? gaps.join(", ") : t("No free time")}
                    </li>
                  );
                })}
              </ul>
              <p>
                {t(
                  "Tell the chat what interests you and any days or times to avoid.",
                )}
              </p>
            </details>
          )}
          {!messages.length && (
            <div className="chat-starters">
              <p className="chat-starters-caption">
                {t("เริ่มต้นจากคำถามเหล่านี้")}
              </p>
              <div className="chat-starter-grid">
                {starters.map((choice) => (
                  <button
                    key={choice.id}
                    aria-label={t(choice.title)}
                    disabled={busy}
                    onClick={() => begin(choice)}
                  >
                    <span className={`starter-icon starter-${choice.icon}`}>
                      <Icon name={choice.icon} />
                    </span>
                    <strong>{t(choice.title)}</strong>
                    <span>{t(choice.description)}</span>
                    <span className="starter-prompt">
                      {t(choice.example)} <Icon name="arrow" />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <form
            className="chat-compose"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <label className="sr-only" htmlFor="chat-message">
              {t("ถามเรื่องรายวิชา GE")}
            </label>
            <div>
              <input
                id="chat-message"
                ref={messageInput}
                value={message}
                maxLength={1000}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t(
                  starter?.example || "เช่น สนใจธุรกิจ ว่างวันพุธ 09:00-16:00",
                )}
                disabled={busy}
              />
              <button
                className="primary chat-send"
                aria-label={busy ? t("กำลังค้นหา…") : t("ส่งข้อความ")}
                disabled={busy || !message.trim() || !timetable.ready}
              >
                <Icon name="arrow" />
              </button>
            </div>
          </form>
          <p className="chat-footnote">
            {t("อ้างอิงข้อมูลรายวิชา · ยังไม่ยืนยันภาคเรียนปัจจุบัน")}
          </p>
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
          {response && !response.needs_clarification && (
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
                {t("GE data:")}{" "}
                <SourceLink url={response.sources.ge.source_url}>
                  {response.sources.ge.source_name ||
                    response.sources.ge.source_url ||
                    t("ไม่ทราบ")}
                </SourceLink>{" "}
                {response.sources.ge.updated_at &&
                  `${t("· อัปเดต ")}${response.sources.ge.updated_at}`}
                {t(" · ภาคเรียน:")}{" "}
                {response.sources.ge.academic_year &&
                response.sources.ge.semester
                  ? `${response.sources.ge.semester}/${response.sources.ge.academic_year}`
                  : t("รอยืนยัน")}
              </p>
              {response.results.length > 0 && (
                <TimetableRecommendations
                  key={response.results
                    .map(({ course }) => course.subject_code)
                    .join("|")}
                  results={response.results}
                  target={response.state?.competency}
                  competencies={competencies}
                  timetable={timetable}
                  busy={busy && !response.answer_pending}
                />
              )}
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
          {classification.status === "verified"
            ? t("GE ยืนยันจาก export")
            : classification.status === "mock"
              ? t("GE จำลอง")
              : t("ยังไม่ยืนยันว่าเป็น GE")}
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
        {classification.competencies
          .map((id) => {
            const label = t(competencies[id - 1]);
            const weight = classification.competency_weights?.[id];
            return weight ? `${label} (${weight}%)` : label;
          })
          .join(", ") || t("ไม่ทราบ")}
      </p>
      <p className="hint">
        {t(
          sections.length
            ? "มีหมู่เรียนใน snapshot · ไม่ยืนยันการเปิดสอนปัจจุบัน"
            : "พบรายวิชาใน catalog · ไม่พบหมู่ที่ตรงเงื่อนไขใน snapshot",
        )}
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

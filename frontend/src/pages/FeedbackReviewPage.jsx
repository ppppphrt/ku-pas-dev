import { useState } from "react";
import { api, errorMessage } from "../services/courseApi";
import { useLanguage } from "../hooks/useLanguage";

export default function FeedbackReviewPage() {
  const { language } = useLanguage();
  const l = (th, en) => (language === "th" ? th : en);
  const [draftKey, setDraftKey] = useState("");
  const [key, setKey] = useState("");
  const [status, setStatus] = useState("pending");
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [reviewer, setReviewer] = useState("");
  const [note, setNote] = useState("");
  const [input, setInput] = useState("");
  const [answer, setAnswer] = useState("");
  const [sourceChecked, setSourceChecked] = useState(false);
  const [privacyChecked, setPrivacyChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const headers = (value = key) => ({ "X-Feedback-Review-Key": value });
  async function load(value = key, filter = status) {
    setBusy(true);
    setError("");
    try {
      const { data } = await api.get("/feedback/review", {
        headers: headers(value),
        params: { status: filter },
      });
      setItems(data.items);
      setKey(value);
      setDraftKey("");
      setSelected(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function choose(id) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const { data } = await api.get(`/feedback/review/${id}`, {
        headers: headers(),
      });
      setSelected(data);
      setNote("");
      setSourceChecked(false);
      setPrivacyChecked(false);
      setInput(
        data.training_input ||
          JSON.stringify(
            {
              question: data.snapshot.question,
              history: data.snapshot.history,
              state: data.snapshot.state,
              dataset_version: data.snapshot.dataset_version,
              reference: data.snapshot.evidence,
            },
            null,
            2,
          ),
      );
      setAnswer(data.corrected_answer || data.snapshot.answer);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function decide(decision) {
    setBusy(true);
    setError("");
    try {
      await api.put(
        `/feedback/review/${selected.id}`,
        {
          expected_version: selected.version,
          decision,
          reviewer,
          review_note: note,
          training_input: input,
          corrected_answer: answer,
          source_checked: sourceChecked,
          privacy_checked: privacyChecked,
        },
        { headers: headers() },
      );
      setNotice(
        l(
          "บันทึกผลตรวจแล้ว ยังไม่มีการฝึกโมเดลอัตโนมัติ",
          "Review saved. No model was trained automatically.",
        ),
      );
      await load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function download(split) {
    setBusy(true);
    setError("");
    try {
      const { data } = await api.get("/feedback/export", {
        headers: headers(),
        params: { split },
        responseType: "blob",
      });
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `chat-ge-${split}.jsonl`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main id="main" className="container feedback-review">
      <h1>{l("ตรวจความคิดเห็น Chat GE", "Review Chat GE feedback")}</h1>
      <p>
        {l(
          "ความคิดเห็นจากผู้ใช้เป็นข้อมูลให้ตรวจ ไม่ใช่คำตอบมาตรฐาน ต้องตรวจแหล่งข้อมูลและข้อมูลส่วนตัวก่อนอนุมัติ",
          "User feedback is a review signal, not ground truth. Verify sources and privacy before approving an example.",
        )}
      </p>
      {!key ? (
        <form
          className="feedback-form"
          onSubmit={(e) => {
            e.preventDefault();
            load(draftKey);
          }}
        >
          <label htmlFor="review-key">
            {l("รหัสผู้ตรวจ", "Reviewer access key")}
          </label>
          <input
            id="review-key"
            type="password"
            value={draftKey}
            onChange={(e) => setDraftKey(e.target.value)}
            autoComplete="off"
            required
          />
          <button disabled={busy || !draftKey}>
            {l("เปิดรายการรอตรวจ", "Open review queue")}
          </button>
        </form>
      ) : (
        <>
          <div className="review-toolbar">
            <label>
              {l("สถานะ", "Status")}{" "}
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  load(key, e.target.value);
                }}
                disabled={busy}
              >
                <option value="pending">{l("รอตรวจ", "Pending")}</option>
                <option value="approved">{l("อนุมัติแล้ว", "Approved")}</option>
                <option value="rejected">{l("ไม่อนุมัติ", "Rejected")}</option>
              </select>
            </label>
            <button onClick={() => load()} disabled={busy}>
              {l("โหลดใหม่", "Refresh")}
            </button>
            <button onClick={() => download("train")} disabled={busy}>
              {l("ส่งออกชุดฝึกที่ผ่านตรวจ", "Export reviewed training set")}
            </button>
            <button onClick={() => download("eval")} disabled={busy}>
              {l("ส่งออกชุดประเมินที่แยกไว้", "Export held-out evaluation set")}
            </button>
            <button
              onClick={() => {
                setKey("");
                setItems([]);
                setSelected(null);
                setInput("");
                setAnswer("");
              }}
            >
              {l("ออกจากหน้าตรวจ", "End review session")}
            </button>
          </div>
          <p className="hint">
            {l(
              "ส่งออกเฉพาะตัวอย่างที่อนุมัติและผู้ใช้ยินยอมให้เตรียมชุดฝึก/ประเมิน แยกชุดประมาณ 80/20 ตามตัวอย่าง ไม่มีการเผยแพร่หรือฝึกอัตโนมัติ",
              "Exports include only approved examples with training/evaluation consent. Examples are assigned to approximately 80/20 train/evaluation splits. Nothing is published or trained automatically.",
            )}
          </p>
          <div className="review-layout">
            <section aria-label={l("รายการความคิดเห็น", "Feedback list")}>
              {!items.length && (
                <p>
                  {l("ไม่มีรายการในสถานะนี้", "No items with this status.")}
                </p>
              )}
              {items.map((item) => (
                <article key={item.id} className="review-item">
                  <strong>
                    {item.category} · {item.rating}
                  </strong>
                  <p>{item.snapshot.question}</p>
                  <p>{item.comment}</p>
                  <button onClick={() => choose(item.id)} disabled={busy}>
                    {l("ตรวจรายการ", "Review item")}
                  </button>
                </article>
              ))}
            </section>
            {selected && (
              <section
                className="feedback-form"
                aria-label={l("ตรวจและแก้ตัวอย่าง", "Review and edit example")}
              >
                <h2>{l("ตรวจและแก้ตัวอย่าง", "Review and edit example")}</h2>
                <p>
                  {l(
                    "ความยินยอมสำหรับชุดฝึก/ประเมิน:",
                    "Training/evaluation consent:",
                  )}{" "}
                  {selected.allow_training
                    ? l("อนุญาต", "Granted")
                    : l(
                        "ไม่อนุญาต ส่งออกไม่ได้",
                        "Not granted; excluded from exports",
                      )}{" "}
                  · {selected.dataset_split}
                </p>
                <details>
                  <summary>
                    {l(
                      "หลักฐานต้นฉบับและประวัติการตรวจ",
                      "Original evidence and review history",
                    )}
                  </summary>
                  <pre>
                    {JSON.stringify(
                      {
                        snapshot: selected.snapshot,
                        reviews: selected.reviews,
                      },
                      null,
                      2,
                    )}
                  </pre>
                </details>
                <label htmlFor="training-input">
                  {l(
                    "คำถามและบริบทที่ตรวจแก้แล้ว",
                    "Reviewed question and context",
                  )}
                </label>
                <textarea
                  id="training-input"
                  rows={9}
                  maxLength={20000}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                />
                <label htmlFor="corrected-answer">
                  {l("คำตอบที่ควรเป็น", "Corrected answer")}
                </label>
                <textarea
                  id="corrected-answer"
                  rows={6}
                  maxLength={10000}
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                />
                <label htmlFor="reviewer-name">
                  {l("ชื่อผู้ตรวจ", "Reviewer name")}
                </label>
                <input
                  id="reviewer-name"
                  value={reviewer}
                  maxLength={100}
                  onChange={(e) => setReviewer(e.target.value)}
                />
                <label htmlFor="review-note">
                  {l(
                    "เหตุผลและแหล่งข้อมูลที่ใช้ตรวจ",
                    "Review rationale and sources",
                  )}
                </label>
                <textarea
                  id="review-note"
                  rows={3}
                  value={note}
                  maxLength={2000}
                  onChange={(e) => setNote(e.target.value)}
                />
                <label className="feedback-check">
                  <input
                    type="checkbox"
                    checked={sourceChecked}
                    onChange={(e) => setSourceChecked(e.target.checked)}
                  />
                  {l(
                    "ตรวจข้อเท็จจริงกับแหล่งข้อมูลและเวอร์ชันข้อมูลแล้ว",
                    "Facts checked against sources and the dataset version",
                  )}
                </label>
                <label className="feedback-check">
                  <input
                    type="checkbox"
                    checked={privacyChecked}
                    onChange={(e) => setPrivacyChecked(e.target.checked)}
                  />
                  {l(
                    "ตรวจและลบข้อมูลส่วนตัวจากคำถาม บริบท และคำตอบสำหรับส่งออกแล้ว",
                    "Personal information reviewed and removed from export input and answer",
                  )}
                </label>
                <div className="review-toolbar">
                  <button
                    disabled={
                      busy ||
                      !input.trim() ||
                      !answer.trim() ||
                      !reviewer.trim() ||
                      !note.trim() ||
                      !sourceChecked ||
                      !privacyChecked
                    }
                    onClick={() => decide("approved")}
                  >
                    {l(
                      "อนุมัติตัวอย่างที่แก้แล้ว",
                      "Approve corrected example",
                    )}
                  </button>
                  <button
                    disabled={busy || !reviewer.trim() || !note.trim()}
                    onClick={() => decide("rejected")}
                  >
                    {l("ไม่อนุมัติ", "Reject")}
                  </button>
                </div>
              </section>
            )}
          </div>
        </>
      )}
      {busy && <p role="status">{l("กำลังดำเนินการ…", "Working…")}</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
    </main>
  );
}

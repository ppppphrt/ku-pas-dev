import { useId, useState } from "react";
import { api, errorMessage } from "../services/courseApi";
import { useLanguage } from "../hooks/useLanguage";

export default function ChatFeedback({ receipt }) {
  const { language } = useLanguage();
  const l = (th, en) => (language === "th" ? th : en);
  const id = useId();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState("not_helpful");
  const [category, setCategory] = useState("understanding");
  const [comment, setComment] = useState("");
  const [consent, setConsent] = useState(false);
  const [training, setTraining] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  if (!receipt) return null;
  if (sent)
    return (
      <p className="hint" role="status">
        {l(
          "รับความคิดเห็นแล้ว รอผู้ตรวจพิจารณา",
          "Feedback received and awaiting review.",
        )}
      </p>
    );
  return (
    <div className="chat-feedback">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}>
        {l("แสดงความคิดเห็นต่อคำตอบนี้", "Give feedback on this answer")}
      </button>
      {open && (
        <form
          className="feedback-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy || !consent) return;
            setBusy(true);
            setError("");
            try {
              await api.post("/feedback", {
                receipt,
                rating,
                category,
                comment,
                consent,
                allow_training: training,
              });
              setSent(true);
            } catch (err) {
              setError(errorMessage(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <label htmlFor={`${id}-rating`}>
            {l("คำตอบนี้ช่วยได้ไหม", "Was this answer helpful?")}
          </label>
          <select
            id={`${id}-rating`}
            value={rating}
            onChange={(e) => setRating(e.target.value)}
          >
            <option value="not_helpful">
              {l("ควรปรับปรุง", "Needs improvement")}
            </option>
            <option value="helpful">{l("ช่วยได้", "Helpful")}</option>
          </select>
          <label htmlFor={`${id}-category`}>
            {l("เรื่องที่ต้องการแนะนำ", "Feedback category")}
          </label>
          <select
            id={`${id}-category`}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="understanding">
              {l("เข้าใจคำถามหรือบริบท", "Understanding or context")}
            </option>
            <option value="facts">
              {l("ความถูกต้องของข้อมูล", "Factual accuracy")}
            </option>
            <option value="retrieval">
              {l("ผลค้นหารายวิชา", "Course search results")}
            </option>
            <option value="style">
              {l("ภาษาและความยาวคำตอบ", "Style and length")}
            </option>
            <option value="other">{l("อื่น ๆ", "Other")}</option>
          </select>
          <label htmlFor={`${id}-comment`}>
            {l("เหตุผลหรือสิ่งที่ควรแก้", "Reason or suggested correction")}
          </label>
          <textarea
            id={`${id}-comment`}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={2000}
            required={rating === "not_helpful"}
            rows={3}
          />
          <p className="hint">
            {l(
              "โปรดอย่าใส่รหัสผ่าน เลขประจำตัว หรือข้อมูลส่วนตัวของผู้อื่น",
              "Please omit passwords, identification numbers and other people's private information.",
            )}
          </p>
          <label className="feedback-check">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              required
            />
            {l(
              "ยินยอมให้เก็บคำถาม คำตอบ บริบทที่เกี่ยวข้อง และความคิดเห็นนี้ให้ผู้ดูแลตรวจปรับปรุงระบบ",
              "I consent to storing this question, answer, related context and feedback for a reviewer to improve the system.",
            )}
          </label>
          <label className="feedback-check">
            <input
              type="checkbox"
              checked={training}
              onChange={(e) => setTraining(e.target.checked)}
            />
            {l(
              "อนุญาตให้นำตัวอย่างที่ตรวจและลบข้อมูลส่วนตัวแล้วไปเตรียมชุดฝึกหรือชุดประเมิน (ไม่บังคับ)",
              "Allow reviewed, de-identified examples to be prepared for training or evaluation (optional).",
            )}
          </label>
          <p className="hint">
            {l(
              "ความคิดเห็นจะไม่เปลี่ยนโมเดลหรือฐานความรู้อัตโนมัติ",
              "Feedback does not automatically change the model or knowledge base.",
            )}
          </p>
          <button
            type="submit"
            disabled={
              busy || !consent || (rating === "not_helpful" && !comment.trim())
            }
          >
            {busy
              ? l("กำลังส่ง…", "Submitting…")
              : l("ส่งความคิดเห็น", "Submit feedback")}
          </button>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
        </form>
      )}
    </div>
  );
}

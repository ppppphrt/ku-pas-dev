import { useEffect, useState } from "react";
import { useLanguage } from "../hooks/useLanguage";

const stages = {
  search: [
    "กำลังอ่านคำถามและค้นหาวิชาที่ตรงกับเงื่อนไขของคุณ",
    "กำลังรอผลค้นหาจากระบบ บางคำถามอาจใช้เวลานานกว่าปกติครับ",
    "ยังรอผลค้นหาอยู่ครับ ผลลัพธ์จะแสดงที่นี่เมื่อพร้อม",
  ],
  explanation: [
    "ผลค้นหาพร้อมแล้ว กำลังเรียบเรียงคำอธิบายเพิ่มเติม",
    "กำลังรอคำอธิบายเพิ่มเติม ระหว่างนี้เปิดดูรายวิชาได้เลยครับ",
    "ยังรอคำอธิบายเพิ่มเติมอยู่ครับ คุณดูผลค้นหาที่แสดงแล้วได้เลย",
  ],
};

export default function ChatProgress({ phase }) {
  const { t } = useLanguage();
  const [update, setUpdate] = useState(0);

  useEffect(() => {
    const first = setTimeout(() => setUpdate(1), 8000);
    const second = setTimeout(() => setUpdate(2), 24000);
    return () => {
      clearTimeout(first);
      clearTimeout(second);
    };
  }, []);

  return (
    <div className="chat-bubble assistant" role="status" aria-atomic="true">
      {t(stages[phase][update])}
    </div>
  );
}

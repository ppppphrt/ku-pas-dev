# เปิด KU-PAS MVP demo บน Vercel

โค้ดรวมอยู่ใน `main` แล้ว รองรับ frontend และ FastAPI บนโดเมนเดียว โดยไม่ต้องเปิดคอมเครื่องนี้ไว้

## ตั้งค่า Vercel

1. เข้า Vercel → Add New Project → Import Git Repository → `ppppphrt/ku-pas-dev`
2. ใช้ Production Branch `main` และ Root Directory เป็นราก repository (`./`) **อย่าเลือก `frontend/`** เพราะ API และข้อมูลอยู่ภายนอกโฟลเดอร์นั้น
3. ใช้ Framework Preset **FastAPI** ตาม `vercel.json` และ Node.js **24.x** / Python **3.12** ไม่ต้องใส่ API key หรือ `VITE_API_URL` เพิ่ม
4. Deploy; รอ build สำเร็จ แล้วทดสอบ URL ที่ Vercel ให้ก่อนแชร์
5. ถ้าลิงก์ Production ยังถามให้ล็อกอิน Vercel ให้ตรวจ Deployment Protection และเลือกการเข้าถึงตามกลุ่มผู้ทดลองที่ต้องการ

`vercel.json` ติดตั้ง pnpm 11 และ build React โดยใช้ `VITE_API_URL=/api` และ `VITE_DEMO_MODE=true` ส่วน `app.py` mount API ที่ `/api` และใช้ `app.frontend()` เพื่อให้ Vercel เสิร์ฟ static assets ผ่าน CDN พร้อม fallback สำหรับ React Router ไม่มีการเรียก localhost จากผู้ใช้ demo

## ฟีเจอร์ที่เปิดให้ทดลอง

- ค้นหารหัส/ชื่อวิชา กรองคณะ หน่วยกิต วัน และเวลา
- ดูหมู่เรียน เพิ่ม/ลบวิชา ตรวจเวลาชน และวางแผนหน่วยกิต
- บันทึกตารางใน browser ของแต่ละคน ไม่แชร์ตารางกัน
- GE Chat แบบตามกฎ และสลับไทย/อังกฤษ

ใน public demo **ปิดสมัครบัญชี/ล็อกอินและการบันทึกฝั่ง server** รวมถึงปิด semantic model เพื่อให้ไม่ต้องใช้ฐานข้อมูลถาวรหรือดาวน์โหลดโมเดลใน serverless runtime โหมด local เดิมยังมีบัญชีและ SQLite เหมือนเดิม

ตาราง Guest หายได้เมื่อล้างข้อมูลเว็บไซต์ เปลี่ยน browser/อุปกรณ์ หรือใช้ private browsing ไม่ใช่การลงทะเบียนใน MY.KU ข้อมูล snapshot ยังไม่ยืนยันภาคเรียนปัจจุบัน และ GE บางส่วนเป็นข้อมูลจำลองตามป้ายในแอป ห้ามอ้างว่าเป็นข้อมูลเปิดลงทะเบียนล่าสุด

## เช็กก่อนส่งลิงก์

- `/api/health` ตอบ JSON `status: ok`, `courses_loaded` มากกว่า 0
- `/api/metadata` ตอบ `demo_mode: true`
- เปิดจากมือถือ/คอมที่ไม่ใช่เครื่องพัฒนา ค้นหา `01001241-64` และเพิ่มหมู่ที่มีตารางครบ
- ลองเพิ่มหมู่ 400 ของ `01001241-64` และหมู่ 1 ของ `01001251-64` เพื่อให้ระบบตรวจคาบชนวันพุธ 09:00–12:00
- รีเฟรช `/timetable` แล้ววิชาที่บันทึกยังอยู่ ลบและล้างตารางได้
- เปิด `/chat` และลิงก์หน้ารายวิชาโดยตรง ต้องไม่เป็น 404; สลับภาษาแล้วใช้งานต่อได้
- ลอง GE Chat `สนใจภาษา` และเลือกหมู่ใส่ตาราง
- เปิดแท็บส่วนตัวอีกอันเพื่อตรวจว่าตารางไม่ปนกับ browser เดิม
- หน้าแรกแสดงข้อจำกัดข้อมูลและการเก็บตารางแบบ Guest และไม่มีปุ่มสมัคร/ล็อกอิน

หลังผ่านรายการนี้ ให้กลุ่มเล็กทดลองก่อน พร้อมช่องทางแจ้งปัญหาที่เจ้าของโครงการเลือก โดยขอเพียงขั้นตอนที่ทำ URL และภาพหน้าจอที่ไม่ติดข้อมูลส่วนตัว

## สถานะการตรวจ

ทดสอบ backend ผ่าน 47 รายการ และ frontend ผ่าน 15 รายการ พร้อม lint และ build โหมด demo ผ่านแล้ว การทดสอบในเครื่องตรวจ deployment entrypoint, API ที่ `/api`, การค้นหา, การตรวจตาราง, GE Chat, ปิดบัญชี และ fallback ของหน้าย่อยได้ แต่ยังไม่แทนการทดสอบ deployment จริงบน Vercel ต้องผ่าน build และรายการด้านบนบน URL จริงก่อนประกาศพร้อมให้ใช้

เอกสารอ้างอิง: [FastAPI บน Vercel](https://vercel.com/docs/frameworks/backend/fastapi), [Python runtime](https://vercel.com/docs/functions/runtimes/python)

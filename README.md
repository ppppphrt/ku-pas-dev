# KU-PAS MVP

## Public demo บน Vercel

รวมงาน GE Chat, ไทย/อังกฤษ และ UI ล่าสุดเข้า `main` แล้ว ตั้งค่า deploy จากราก repository ตาม [คู่มือ Vercel demo](docs/VERCEL-DEMO.md) เปิดฟีเจอร์หลักแบบ Guest และเก็บตารางใน browser โดยปิดบัญชีเฉพาะ public demo


## GE Chat — branch `gened-regis`

ดับเบิลคลิก `run-chat.command` หรือเปิดด้วย `./run-local.command --keyword-only` แล้วเข้า **GE Chat** หรือ `http://127.0.0.1:5173/chat` ใช้แชทค้นหาจากความสนใจ รหัสวิชา กลุ่มสาระ 64 / สมรรถนะ 67 วันและช่วงเวลาที่ว่าง พร้อมเลือกหมู่ลงใน Timetable Planner เดิม ระบบตรวจเวลาชนทุกคาบก่อนบันทึก

รุ่นเริ่มต้นไม่ต้องซื้อ API key และไม่ส่งข้อความออกไปยัง OpenAI: ค่าเริ่มต้นเป็น **ตัวช่วยแชทตามกฎ ไม่ใช่ LLM** รองรับการถามต่อ เช่น `สนใจภาษา` → `เฉพาะวันศุกร์ 09:00-16:00` และใช้แผงตัวกรองช่วยแก้เงื่อนไขได้ หากต้องการ AI ภาษาธรรมชาติ ให้ติดตั้ง Ollama และโมเดลที่รองรับภาษาไทยบนเครื่องก่อน แล้วตั้ง `CHAT_OLLAMA_MODEL` เป็นชื่อโมเดลที่ติดตั้ง เช่น `CHAT_OLLAMA_MODEL=ชื่อโมเดล ./run-local.command --keyword-only` ระบบจะเรียกเฉพาะ `127.0.0.1:11434` เพื่อแปลงข้อความเป็นตัวกรองที่ตรวจ schema แล้ว หากโมเดลไม่พร้อมจะกลับไปใช้โหมดตามกฎโดยอัตโนมัติ ไม่มีการดาวน์โหลดโมเดลอัตโนมัติจากหน้า Chat และยังไม่มีการเชื่อม OpenAI API ใน branch นี้

ข้อมูลรายวิชา/หมู่/เวลา/จำนวนรับ/จำนวนลงทะเบียนมาจาก KU Drive snapshot เดิม ตรวจ SHA-256 เทียบไฟล์ต้นทางทั้ง 3 ไฟล์เมื่อ 24 ต.ค. 2569 แล้วตรงกัน ภาคเรียนปัจจุบันยังยืนยันไม่ได้ ข้อมูล GE และการเปิดสอนใน `backend/data/gened.json` เป็น **ข้อมูลจำลอง** 84 รายการรหัสวิชา (หลายเวอร์ชันของ 24 รหัสฐาน) และ 307 หมู่ ไม่ครอบคลุม GE ทั้งหมด ป้ายจำลองปรากฏทั้งระดับรายวิชาและหมู่เรียน แยกจำนวนที่นั่งจริงจาก snapshot กับจำนวนที่นั่งจำลอง และไม่ยืนยันสิทธิ์เฉพาะบุคคลจากประเภทภาคเพียงอย่างเดียว การเพิ่มตารางคือการวางแผน ไม่ได้ลงทะเบียนกับ MY.KU

ดู [คู่มือข้อมูลและการนำเข้า](docs/GENED-REGIS.md) สำหรับแทน mock ด้วย export จริง

ระบบค้นหารายวิชาและจัดตารางเรียนสำหรับทดลองบนเครื่อง ใช้ข้อมูลรายวิชา หมู่เรียน และเวลาเรียนจาก KU Drive ที่ผู้ใช้ให้มา ไม่ต้องเชื่อม GitHub เพื่อเปิดแอป

## เปิดใช้งานบน Mac เครื่องนี้

เปิด Terminal ในโฟลเดอร์นี้ แล้วเรียก:

```bash
./run-local.command
```

รอข้อความ `Ready: http://127.0.0.1:5173/` แล้วเปิด URL ดังกล่าว กด Ctrl+C ใน Terminal เพื่อหยุดทั้ง frontend/backend

ตัวเปิดใช้ Python environment ที่เตรียมไว้ในงานนี้ได้ หากเปิดจากเครื่องอื่นจะสร้าง `.venv` และติดตั้ง dependencies ภายในโฟลเดอร์โปรเจกต์ ใช้ Python 3.12+ การเปิด AI ครั้งแรกต้องดาวน์โหลดโมเดลและสร้าง embeddings อาจใช้เวลาหลายนาที หลังจากนั้นใช้ cache เดิมได้

ถ้าต้องการเริ่มค้นหาด้วยรหัส/ชื่อและจัดตารางโดยไม่รอ AI:

```bash
./run-local.command --keyword-only
```

Windows/Linux ใช้ `python run_local.py` หรือ `python3 run_local.py` ได้ ตัวเปิดและ frontend build ที่แนบมาไม่ต้องใช้ Node.js

ถ้าพอร์ต 5173 หรือ 8000 ถูกใช้งานอยู่ ให้หยุดแอปเก่าก่อน ระบบไม่ปิดโปรแกรมอื่นให้เอง

## ทดลองฟีเจอร์หลัก

1. ค้นหารหัส `01001241-64` หรือค้นหาชื่อวิชา
2. กรองคณะ หน่วยกิต วัน และช่วงเวลา แล้วกด **Apply filters** ทุกคาบในหมู่ที่ตรงเงื่อนไขต้องอยู่ในวัน/เวลาที่อนุญาต
3. เปิด **Details and section selection** เลือกหมู่ที่มีตารางครบ แล้วกด **Add selected section**
4. เปิด **Timetable Planner** ตรวจจำนวนวิชา หน่วยกิต และคาบเรียน รีเฟรชหน้าเพื่อทดสอบการบันทึก
5. ตัวอย่างคาบชน: วิชา `01001241-64` หมู่ 400 และ `01001251-64` หมู่ 1 ต่างเรียนวันพุธ 09:00–12:00 ระบบเตือนและไม่เพิ่มวิชาที่ชน
6. ลบรายวิชาด้วย **Remove** หรือกด **Clear timetable** และยืนยันเพื่อล้างทั้งหมด

Guest ใช้งานฟีเจอร์หลักได้ทันทีและบันทึกใน browser บัญชีที่สมัครผ่านแอปนี้เป็นบัญชี local ไม่ใช่ KU SSO และมีตารางแยกจาก Guest เกณฑ์หน่วยกิต 9–22 เป็นค่าตั้งต้นสำหรับการทดลอง เปลี่ยนได้ด้วย `MIN_CREDITS` / `MAX_CREDITS` และต้องยืนยันกับหลักสูตรจริง

## โครงสร้าง

- `backend/`: FastAPI, schemas, data importer, conflict/credit rules, local accounts, tests
- `frontend/`: React source, tests และ `dist/` ที่ build พร้อมเปิด
- `backend/data/catalog.json.gz`: catalog ที่ join แล้ว ไม่มีข้อมูลนักศึกษา
- `backend/contracts/`: JSON schemas ที่ frontend/backend ใช้ร่วมกัน
- `next-task.md`: สถานะ MVP และงานที่ยังเปิดอยู่
- `docs/BACKLOG.original.md`: backlog เดิมที่ได้รับจากผู้ใช้
- `docs/VERIFICATION.md`: ผลตรวจและข้อจำกัดการทดสอบ

## ข้อมูลและข้อจำกัด

แหล่งข้อมูล: [KU Drive ที่ผู้ใช้ให้มา](https://kudrive.ku.ac.th/index.php/s/s8ccWBcJLGAGDaT) ใช้เฉพาะ `subjects.xlsx`, `sections.xlsx`, `schedules.xlsx` ไม่ได้นำ `enrollments.xlsx` เข้าระบบ

ข้อมูลมี 46,942 วิชา และ 15,639 หมู่เรียน มี 11,535 หมู่ที่มีตารางครบและผ่าน validation ปีการศึกษา/ภาคเรียน ห้องเรียน ภาควิชา และวิชาบังคับก่อนไม่ได้ระบุในต้นทาง จึงแสดงว่าไม่ทราบ หมู่ที่ตารางขาดหรือผิดจะเลือกเพิ่มไม่ได้ ไม่ใช่ตารางเปิดลงทะเบียนปัจจุบันที่ได้รับการยืนยัน

ตัวเลข 12,456 วิชาใน backlog ยังยืนยันไม่ได้ เพราะไม่ได้รับ SRS และกฎนับหลักสูตร ไม่มีการตัดข้อมูลให้ตรงตัวเลขนั้น ดู `backend/data/workbook-validation.json` สำหรับผลตรวจ snapshot ใหม่ ส่วน `validation.json` และ `VALIDATION.md` เป็นผลตรวจ CSV เก่าจาก archive แรก

## พัฒนาหรือทดสอบโค้ด

Backend:

```bash
python3 -m venv .venv
.venv/bin/pip install -r backend/requirements.txt -r backend/requirements-dev.txt
cd backend
../.venv/bin/pytest -q
../.venv/bin/ruff check .
```

หากต้องใช้ AI ให้ติดตั้ง `backend/requirements-ai.txt` เพิ่ม ใช้ `requirements-lock.txt` เป็นบันทึก versions ของ environment ที่ทดสอบ

Frontend (Node.js 24 และ pnpm 11):

```bash
cd frontend
pnpm install --frozen-lockfile
pnpm lint
pnpm test
pnpm build
```

ตั้ง `VITE_API_URL` ผ่าน `.env` ได้ตาม `.env.example` และ build ใหม่เมื่อเปลี่ยน URL ส่วน production มี `.env.production.example` ให้แก้ตามปลายทางจริง CORS ของ backend จำกัด localhost เป็นค่าเริ่มต้น

อัปเดตข้อมูลด้วย `python backend/import_ku_data.py /path/to/workbooks --output-dir backend/data` หลังติดตั้ง dependencies แล้ว รายการอ้างอิงหมู่เรียนในตารางผูกกับ dataset version หาก snapshot เปลี่ยน ระบบให้ตรวจ/ล้างตารางเก่าแทนการจับคู่ข้อมูลใหม่โดยเงียบ ๆ

ยังไม่ได้ deploy หรือรับรอง production security/SSO งานประเมิน AI เชิงวิจัยและทดสอบกับนักศึกษาเป็นงานระยะถัดไปตาม `next-task.md`

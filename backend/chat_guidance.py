"""Catalog lookup and bounded, illustrative career guidance."""

import re
import unicodedata

CAREER = re.compile(r"ทำงาน|สายงาน|อาชีพ|\b(?:career|job|work as|become)\b", re.I)
CAREER_PATHS = (
    (
        ("นักวิเคราะห์ข้อมูล", "data analyst", "data scientist", "นักวิทยาศาสตร์ข้อมูล"),
        ("การวิเคราะห์ข้อมูล", "สถิติ", "ฐานข้อมูล", "data analytics", "statistics", "database"),
    ),
    (
        ("นักพัฒนาซอฟต์แวร์", "โปรแกรมเมอร์", "software developer", "software engineer", "programmer"),
        (
            "การเขียนโปรแกรม",
            "วิศวกรรมซอฟต์แวร์",
            "ฐานข้อมูล",
            "programming",
            "software engineering",
            "database",
        ),
    ),
    (
        ("นักการตลาด", "การตลาด", "marketing"),
        ("การตลาด", "พฤติกรรมผู้บริโภค", "marketing", "consumer behavior"),
    ),
)

GARDENING = (
    ("ทำสวน", "ปลูกพืช", "พืชสวน", "จัดสวน", "สวนพืช", "horticulture", "gardening"),
    ("พืชสวน", "ปลูกพืช", "จัดสวน", "horticulture", "gardening"),
)


def normalized_title(value):
    value = unicodedata.normalize("NFKC", value).casefold()
    return "".join(c for c in value if not c.isspace() and unicodedata.category(c) != "Cf")


def career_path(message):
    text = message.casefold()
    return next(
        (path for path in (*CAREER_PATHS, GARDENING) if any(term in text for term in path[0])), None
    )


def course_reference(message, catalog, *, embedded=False):
    query = message.strip().strip("“”\"'").strip()
    query = re.sub(r"^(?:ค้นหา|ขอดูวิชา|search for|find)\s*", "", query, flags=re.I)
    needle = normalized_title(query)
    if not needle:
        return None
    best = (0, "")
    for course in catalog.courses:
        if course["campus"] != "บางเขน":
            continue
        for value in (course["subject_code"], course["subject_name_th"], course["subject_name_en"]):
            key = normalized_title(value)
            if key and key == needle:
                return value
            if embedded and len(key) >= 8 and len(key) > best[0] and key in needle:
                best = (len(key), value)
    return best[1] or None


def career_fallback(language, rows, from_course, path=None):
    thai = language == "th"
    if not rows:
        return (
            "ช่วยระบุชื่ออาชีพ หรือชื่อ/รหัสวิชาที่อยากใช้เป็นจุดเริ่มต้นได้ไหมครับ?"
            if thai
            else "Which job title or course name/code would you like to start from?"
        )
    if not from_course:
        if path:
            suggestions = []
            field = "subject_name_th" if thai else "subject_name_en"
            separator = " — "
            seen = set()
            for row in rows:
                course = row["course"]
                title = course[field]
                if not title or title in seen:
                    continue
                skill = next((term for term in path[1] if term in title.casefold()), None)
                if skill:
                    seen.add(title)
                    suggestions.append(f"{course['subject_code']} {title}{separator}{skill}")
                if len(suggestions) == 2:
                    break
            if suggestions:
                intro = (
                    "วิชาที่น่าเริ่มและทักษะจากชื่อวิชา"
                    if thai
                    else "Starting courses and skills indicated by their titles"
                )
                return intro + "\n" + "\n".join(suggestions)
        return (
            "ลองเริ่มจากวิชาในการ์ด แล้วเทียบคำอธิบายรายวิชากับทักษะในประกาศงานที่สนใจครับ"
            if thai
            else "Start with the courses below and compare their descriptions with the skills listed in job postings."
        )
    course = rows[0]["course"]
    titles = course["subject_name_th"] + " " + course["subject_name_en"]
    for roles, skills in (*CAREER_PATHS, GARDENING):
        if any(skill.casefold() in titles.casefold() for skill in skills):
            role = roles[0] if thai else roles[-1]
            return (
                f"เนื้อหาของ {course['subject_code']} เกี่ยวข้องกับทักษะที่นำไปต่อยอดในสาย {role} ได้ "
                "ลองเทียบคำอธิบายวิชากับประกาศงานเพื่อดูว่าต้องฝึกอะไรเพิ่มครับ"
                if thai
                else f"{course['subject_code']} may build skills relevant to {role}. "
                "Compare the course description with a job posting to identify additional skills."
            )
    return (
        "ยังระบุสายงานจากข้อมูลวิชานี้ได้ไม่ชัดครับ บอกทักษะหรือโปรเจกต์ที่ได้ทำในวิชาเพิ่มได้ไหมครับ?"
        if thai
        else "The catalog does not give enough detail to suggest a career confidently. What skills or projects did the course cover?"
    )

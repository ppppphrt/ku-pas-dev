"""Catalog filtering, ranking and authoritative timetable rules."""

import gzip
import hashlib
import json
import logging
import re
from pathlib import Path

from schemas import Course, Filters

log = logging.getLogger(__name__)


def normalized_code(value):
    return re.sub(r"[^a-z0-9]", "", value.casefold())


def overlap(first, second):
    return (
        first["day"] == second["day"]
        and first["start"] < second["end"]
        and second["start"] < first["end"]
    )


def section_matches(section, filters):
    if filters.faculty and section["faculty"] != filters.faculty:
        return False
    if filters.days or filters.start_time or filters.end_time:
        if not section["schedule_complete"]:
            return False
        slots = section["time_slots"]
        # The entire section must fit availability; days are allowed days.
        if filters.days and any(s["day"] not in filters.days for s in slots):
            return False
        if filters.start_time and any(s["start"] < filters.start_time for s in slots):
            return False
        if filters.end_time and any(s["end"] > filters.end_time for s in slots):
            return False
    return True


class Catalog:
    def __init__(self, path):
        source = Path(path)
        content = (
            gzip.open(source, "rt", encoding="utf-8")
            if source.suffix == ".gz"
            else source.open(encoding="utf-8")
        )
        with content as stream:
            payload = json.load(stream)
        self.metadata = payload["metadata"]
        self.courses = [Course.model_validate(c).model_dump() for c in payload["courses"]]
        self.by_code = {c["subject_code"]: c for c in self.courses}
        if len(self.by_code) != len(self.courses):
            raise ValueError("Catalog has duplicate course identities")
        self.model = None
        self.embeddings = None
        self.semantic_error = None
        self.names = [
            (c["subject_name_th"].casefold(), c["subject_name_en"].casefold()) for c in self.courses
        ]
        self.codes = [normalized_code(c["subject_code"]) for c in self.courses]

    def prepare_semantic(self, model_name, cache_dir):
        import numpy as np
        from sentence_transformers import SentenceTransformer

        self.model = SentenceTransformer(model_name)
        texts = [
            " ".join(
                c[f]
                for f in (
                    "subject_name_th",
                    "subject_name_en",
                    "subject_desc_th",
                    "subject_desc_en",
                )
            )
            for c in self.courses
        ]
        # Includes model, preprocessing, text, and row order; JSON/NPY rather than pickle.
        key = hashlib.sha256(
            json.dumps([model_name, "bilingual-v1", texts], ensure_ascii=False).encode()
        ).hexdigest()
        cache = Path(cache_dir) / f"{key}.npy"
        cache.parent.mkdir(parents=True, exist_ok=True)
        if cache.exists():
            try:
                embeddings = np.load(cache, allow_pickle=False)
                if (
                    embeddings.ndim != 2
                    or embeddings.shape
                    != (len(texts), self.model.get_sentence_embedding_dimension())
                    or not np.isfinite(embeddings).all()
                ):
                    raise ValueError("Invalid embedding cache")
                self.embeddings = embeddings
                return
            except (ValueError, OSError):
                log.warning("Embedding cache could not be used; rebuilding.")
        self.embeddings = self.model.encode(
            texts,
            normalize_embeddings=True,
            convert_to_numpy=True,
            show_progress_bar=True,
            batch_size=128,
        )
        temporary = cache.with_suffix(".tmp.npy")
        np.save(temporary, self.embeddings, allow_pickle=False)
        temporary.replace(cache)

    def filtered(self, filters: Filters):
        indices = []
        for i, c in enumerate(self.courses):
            credits = c["credits"]
            if filters.min_credits is not None and (
                credits is None or credits < filters.min_credits
            ):
                continue
            if filters.max_credits is not None and (
                credits is None or credits > filters.max_credits
            ):
                continue
            needs_section = (
                filters.offered_only or filters.days or filters.start_time or filters.end_time
            )
            if needs_section:
                if not any(section_matches(s, filters) for s in c["sections"]):
                    continue
            elif (
                filters.faculty
                and c["faculty"] != filters.faculty
                and not any(s["faculty"] == filters.faculty for s in c["sections"])
            ):
                continue
            indices.append(i)
        return indices

    def keyword(self, query, indices):
        query = " ".join(query.casefold().split())
        code_query = normalized_code(query)
        found = []
        for i in indices:
            names = self.names[i]
            code = self.codes[i]
            if query in names or (code_query and code_query == code):
                score = 0
            elif any(query in name for name in names) or (code_query and code_query in code):
                score = 1
            else:
                continue
            found.append((score, self.courses[i]["subject_code"], i))
        return [(i, None) for _, _, i in sorted(found)]

    def semantic(self, query, indices, threshold):
        if self.model is None or self.embeddings is None:
            raise RuntimeError("Semantic search is not ready. Keyword search remains available.")
        import numpy as np

        vector = self.model.encode([query], normalize_embeddings=True, convert_to_numpy=True)[0]
        scores = self.embeddings[indices] @ vector
        order = np.argsort(-scores, kind="stable")
        return [(indices[j], float(scores[j])) for j in order if scores[j] >= threshold]

    def timetable(self, refs, min_credits=9, max_credits=22):
        items = []
        seen = set()
        for ref in refs:
            code = ref.subject_code
            if code in seen:
                raise ValueError("Select only one section per course; duplicate course found.")
            seen.add(code)
            course = self.by_code.get(code)
            if course is None:
                raise ValueError(f"Course {code} is not in this catalog.")
            section = next(
                (s for s in course["sections"] if s["section_id"] == ref.section_id), None
            )
            if section is None:
                raise ValueError(f"Section {ref.section_id} does not belong to course {code}.")
            if not section["schedule_complete"] or not section["time_slots"]:
                raise ValueError(f"Section {ref.section_id} has no complete schedule.")
            if course["credits"] is None:
                raise ValueError(f"Course {code} has unknown credits.")
            items.append({"course": course, "section": section})
        conflicts = []
        for i, first in enumerate(items):
            for second in items[i + 1 :]:
                for a in first["section"]["time_slots"]:
                    for b in second["section"]["time_slots"]:
                        if overlap(a, b):
                            conflicts.append(
                                {
                                    "first": {
                                        "subject_code": first["course"]["subject_code"],
                                        "section_id": first["section"]["section_id"],
                                    },
                                    "second": {
                                        "subject_code": second["course"]["subject_code"],
                                        "section_id": second["section"]["section_id"],
                                    },
                                    "day": a["day"],
                                    "start": max(a["start"], b["start"]),
                                    "end": min(a["end"], b["end"]),
                                }
                            )
        credits = sum(i["course"]["credits"] for i in items)
        return {
            "dataset_version": self.metadata["dataset_version"],
            "items": items,
            "conflicts": conflicts,
            "course_count": len(items),
            "total_credits": credits,
            "min_credits": min_credits,
            "max_credits": max_credits,
            "credit_status": "Exceeded"
            if credits > max_credits
            else "Warning"
            if credits < min_credits
            else "Normal",
        }

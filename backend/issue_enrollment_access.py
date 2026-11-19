"""Issue an expiring pilot key offline; only its SHA-256 digest goes to the server."""

import argparse
import hashlib
import json
import re
import secrets
from datetime import UTC, datetime, timedelta


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("student_code")
    parser.add_argument("--days", type=int, default=7)
    args = parser.parse_args()
    if not re.fullmatch(r"[0-9]{10}", args.student_code) or not 1 <= args.days <= 30:
        parser.error("Use a 10-digit student code and --days between 1 and 30.")
    key = secrets.token_urlsafe(32)
    print("Student access code (give privately to this student only):")
    print(key)
    print("Merge this entry into server-only KUEDU_STUDENT_ACCESS:")
    print(
        json.dumps(
            {
                hashlib.sha256(key.encode()).hexdigest(): {
                    "student_code": args.student_code,
                    "expires_at": (datetime.now(UTC) + timedelta(days=args.days)).isoformat(),
                }
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()

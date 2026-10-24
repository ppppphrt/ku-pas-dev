"""Local SQLite accounts, scrypt password hashes and revocable JWT sessions."""

import hashlib
import hmac
import json
import secrets
import sqlite3
from datetime import UTC, datetime, timedelta
from pathlib import Path

import jwt


class Accounts:
    def __init__(self, database, secret=None):
        self.path = Path(database)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        secret_path = self.path.with_suffix(".secret")
        if secret is None:
            if not secret_path.exists():
                # Exclusive creation prevents two local servers generating different keys.
                try:
                    with secret_path.open("x") as target:
                        secret_path.chmod(0o600)
                        target.write(secrets.token_urlsafe(48))
                except FileExistsError:
                    pass
            secret = secret_path.read_text()
        if len(secret) < 32:
            raise ValueError("JWT_SECRET must be at least 32 characters")
        self.secret = secret
        with self.connect() as db:
            db.execute(
                "CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username TEXT UNIQUE COLLATE NOCASE, email TEXT UNIQUE COLLATE NOCASE, password TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 0)"
            )
            db.execute(
                "CREATE TABLE IF NOT EXISTS timetables (user_id INTEGER PRIMARY KEY, payload TEXT NOT NULL)"
            )

    def connect(self):
        db = sqlite3.connect(self.path)
        db.row_factory = sqlite3.Row
        return db

    @staticmethod
    def password_hash(password, salt=None):
        salt = salt or secrets.token_hex(16)
        digest = hashlib.scrypt(
            password.encode(), salt=bytes.fromhex(salt), n=16384, r=8, p=1, dklen=32
        ).hex()
        return f"{salt}:{digest}"

    def register(self, username, email, password):
        hashed = self.password_hash(password)
        with self.connect() as db:
            try:
                result = db.execute(
                    "INSERT INTO users(username,email,password) VALUES (?,?,?)",
                    (username, email, hashed),
                )
            except sqlite3.IntegrityError as exc:
                raise ValueError("Username or email already registered.") from exc
            return self.session(
                dict(db.execute("SELECT * FROM users WHERE id=?", (result.lastrowid,)).fetchone())
            )

    def login(self, username, password):
        with self.connect() as db:
            row = db.execute("SELECT * FROM users WHERE username=?", (username,)).fetchone()
        # Run a hash even for unknown users to avoid a fast username existence oracle.
        stored = row["password"] if row else "0" * 32 + ":" + "0" * 64
        candidate = self.password_hash(password, stored.split(":")[0])
        if not hmac.compare_digest(stored, candidate) or row is None:
            raise ValueError("Invalid username or password.")
        return self.session(dict(row))

    def session(self, user):
        now = datetime.now(UTC)
        token = jwt.encode(
            {
                "sub": str(user["id"]),
                "ver": user["version"],
                "iat": now,
                "exp": now + timedelta(hours=8),
                "iss": "ku-pas",
            },
            self.secret,
            algorithm="HS256",
        )
        return {
            "access_token": token,
            "token_type": "bearer",
            "user": {"id": user["id"], "username": user["username"], "email": user["email"]},
        }

    def authenticate(self, token):
        try:
            claims = jwt.decode(
                token,
                self.secret,
                algorithms=["HS256"],
                issuer="ku-pas",
                options={"require": ["exp", "sub", "ver"]},
            )
            with self.connect() as db:
                user = db.execute(
                    "SELECT * FROM users WHERE id=?", (int(claims["sub"]),)
                ).fetchone()
            if user is None or user["version"] != claims["ver"]:
                raise ValueError("Session expired.")
            return dict(user)
        except (jwt.InvalidTokenError, ValueError, KeyError) as exc:
            raise ValueError("Session expired. Please sign in again.") from exc

    def logout(self, user):
        with self.connect() as db:
            db.execute("UPDATE users SET version=version+1 WHERE id=?", (user["id"],))

    def load(self, user):
        with self.connect() as db:
            row = db.execute(
                "SELECT payload FROM timetables WHERE user_id=?", (user["id"],)
            ).fetchone()
        return json.loads(row["payload"]) if row else None

    def save(self, user, payload):
        with self.connect() as db:
            db.execute(
                "INSERT INTO timetables(user_id,payload) VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET payload=excluded.payload",
                (user["id"], json.dumps(payload)),
            )

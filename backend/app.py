from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv
import jwt
from functools import wraps
from werkzeug.security import generate_password_hash, check_password_hash

# ─────────────────────────────────────────────
# LOAD ENV
# ─────────────────────────────────────────────
load_dotenv()

SECRET_KEY   = os.getenv("SECRET_KEY", "dev-secret-change-in-production")
TOKEN_EXPIRY = int(os.getenv("TOKEN_EXPIRY_HOURS", 2))
DB_PATH      = os.getenv("DATABASE_URL", "database.db")
LOAN_DAYS    = 14          # 14-day loan period
FINE_PER_DAY = 2           # ₹2 fine per overdue day

# ─────────────────────────────────────────────
# APP INIT
# ─────────────────────────────────────────────
app = Flask(__name__)

# FIX: Restrict CORS to your frontend origin in production
# Change the origin below to your actual frontend URL
CORS(app, origins=["http://localhost:3000"])

# ─────────────────────────────────────────────
# DATABASE
# ─────────────────────────────────────────────
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id       INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT    NOT NULL UNIQUE,
                password TEXT    NOT NULL,
                role     TEXT    NOT NULL DEFAULT 'user',
                email    TEXT    NOT NULL
            )
        """)

        conn.execute("""
            CREATE TABLE IF NOT EXISTS books (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                title     TEXT    NOT NULL,
                author    TEXT    NOT NULL,
                isbn      TEXT,
                available INTEGER NOT NULL DEFAULT 1,
                due_date  TEXT,
                user_id   INTEGER,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """)

        conn.execute("""
            CREATE TABLE IF NOT EXISTS fines (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id     INTEGER NOT NULL,
                book_id     INTEGER NOT NULL,
                amount      INTEGER NOT NULL,
                paid        INTEGER NOT NULL DEFAULT 0,
                created_at  TEXT    NOT NULL DEFAULT (date('now')),
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (book_id) REFERENCES books(id)
            )
        """)

        conn.commit()

        # ── Migrations: safely add new columns to existing databases ──
        existing_book_cols = [r[1] for r in conn.execute("PRAGMA table_info(books)").fetchall()]
        if "isbn" not in existing_book_cols:
            conn.execute("ALTER TABLE books ADD COLUMN isbn TEXT")
        conn.commit()

init_db()

# ─────────────────────────────────────────────
# AUTH MIDDLEWARE
# ─────────────────────────────────────────────
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        # Support "Bearer <token>" or raw token
        token = auth_header.replace("Bearer ", "").strip()

        if not token:
            return jsonify({"error": "Token missing"}), 403

        try:
            data = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token expired, please log in again"}), 403
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 403

        return f(data, *args, **kwargs)

    return decorated

def admin_required(f):
    """Use on top of token_required — checks role is admin."""
    @wraps(f)
    def decorated(user, *args, **kwargs):
        if user.get("role") != "admin":
            return jsonify({"error": "Admin access required"}), 403
        return f(user, *args, **kwargs)
    return decorated

# ─────────────────────────────────────────────
# HELPER: overdue fine calculation
# ─────────────────────────────────────────────
def calculate_fine(due_date_str):
    if not due_date_str:
        return 0
    due_date = datetime.strptime(due_date_str, "%Y-%m-%d")
    today    = datetime.now()
    if today > due_date:
        late_days = (today - due_date).days
        return late_days * FINE_PER_DAY
    return 0

# ─────────────────────────────────────────────
# AUTH ROUTES
# ─────────────────────────────────────────────

@app.route("/")
def home():
    return jsonify({"status": "Library API running"})

@app.route("/register", methods=["POST"])
def register():
    data = request.get_json()

    username = (data.get("username") or "").strip()
    password = (data.get("password") or "").strip()
    role     = data.get("role", "user")
    email    = (data.get("email") or "").strip()

    if not username or not password or not email:
        return jsonify({"error": "Username, password, and email are required"}), 400

    if role not in ("user", "admin"):
        return jsonify({"error": "Role must be 'user' or 'admin'"}), 400

    # FIX: Hash the password before storing
    hashed = generate_password_hash(password)

    try:
        with get_db() as conn:
            conn.execute(
                "INSERT INTO users (username, password, role, email) VALUES (?, ?, ?, ?)",
                (username, hashed, role, email)
            )
            conn.commit()
        return jsonify({"message": "Registered successfully"}), 201

    except sqlite3.IntegrityError:
        return jsonify({"error": "Username already exists"}), 400

@app.route("/login", methods=["POST"])
def login():
    data = request.get_json()

    username = (data.get("username") or "").strip()
    password = (data.get("password") or "").strip()

    if not username or not password:
        return jsonify({"error": "Username and password required"}), 400

    conn = get_db()
    user = conn.execute(
        "SELECT id, role, password FROM users WHERE username = ?",
        (username,)
    ).fetchone()

    # FIX: Use check_password_hash instead of plain-text comparison
    if not user or not check_password_hash(user["password"], password):
        return jsonify({"error": "Invalid credentials"}), 401

    token = jwt.encode({
        "user_id": user["id"],
        "role":    user["role"],
        "exp":     datetime.utcnow() + timedelta(hours=TOKEN_EXPIRY)
    }, SECRET_KEY, algorithm="HS256")

    return jsonify({"token": token, "role": user["role"]})

# ─────────────────────────────────────────────
# BOOK ROUTES
# ─────────────────────────────────────────────

@app.route("/books", methods=["GET"])
@token_required
def get_books(user):
    search = request.args.get("q", "").strip()
    conn   = get_db()

    if search:
        like  = f"%{search}%"
        books = conn.execute(
            "SELECT * FROM books WHERE title LIKE ? OR author LIKE ? ORDER BY title",
            (like, like)
        ).fetchall()
    else:
        books = conn.execute(
            "SELECT * FROM books ORDER BY title"
        ).fetchall()

    result = []
    for b in books:
        fine = calculate_fine(b["due_date"]) if not b["available"] else 0
        result.append({
            "id":        b["id"],
            "title":     b["title"],
            "author":    b["author"],
            "isbn":      b["isbn"],
            "available": b["available"],
            "due_date":  b["due_date"],
            "user_id":   b["user_id"],
            "fine":      fine
        })

    return jsonify(result)

@app.route("/books/<int:book_id>", methods=["GET"])
@token_required
def get_book(user, book_id):
    conn = get_db()
    b    = conn.execute("SELECT * FROM books WHERE id = ?", (book_id,)).fetchone()
    if not b:
        return jsonify({"error": "Book not found"}), 404

    fine = calculate_fine(b["due_date"]) if not b["available"] else 0
    return jsonify({
        "id":        b["id"],
        "title":     b["title"],
        "author":    b["author"],
        "isbn":      b["isbn"],
        "available": b["available"],
        "due_date":  b["due_date"],
        "user_id":   b["user_id"],
        "fine":      fine
    })

@app.route("/add_book", methods=["POST"])
@token_required
@admin_required          # FIX: Only admins can add books
def add_book(user):
    data   = request.get_json()
    title  = (data.get("title") or "").strip()
    author = (data.get("author") or "").strip()
    isbn   = (data.get("isbn") or "").strip() or None

    if not title or not author:
        return jsonify({"error": "Title and author are required"}), 400

    with get_db() as conn:
        conn.execute(
            "INSERT INTO books (title, author, isbn) VALUES (?, ?, ?)",
            (title, author, isbn)
        )
        conn.commit()

    return jsonify({"message": "Book added successfully"}), 201

@app.route("/borrow/<int:book_id>", methods=["POST"])
@token_required
def borrow_book(user, book_id):
    conn = get_db()
    book = conn.execute("SELECT * FROM books WHERE id = ?", (book_id,)).fetchone()

    if not book:
        return jsonify({"error": "Book not found"}), 404

    # FIX: Check if already borrowed
    if not book["available"]:
        return jsonify({"error": "Book is currently not available"}), 400

    # Check if this user already has an overdue fine unpaid
    # (optional strict mode — comment out if you want to allow borrowing anyway)
    unpaid = conn.execute(
        "SELECT SUM(amount) FROM fines WHERE user_id = ? AND paid = 0",
        (user["user_id"],)
    ).fetchone()[0] or 0

    due_date = (datetime.now() + timedelta(days=LOAN_DAYS)).strftime("%Y-%m-%d")

    with conn:
        conn.execute(
            "UPDATE books SET available = 0, due_date = ?, user_id = ? WHERE id = ?",
            (due_date, user["user_id"], book_id)
        )

    return jsonify({
        "message":     "Book borrowed successfully",
        "due_date":    due_date,
        "unpaid_fine": unpaid
    })

@app.route("/return/<int:book_id>", methods=["POST"])
@token_required
def return_book(user, book_id):
    conn = get_db()
    book = conn.execute("SELECT * FROM books WHERE id = ?", (book_id,)).fetchone()

    if not book:
        return jsonify({"error": "Book not found"}), 404

    if book["available"]:
        return jsonify({"error": "Book is not currently borrowed"}), 400

    # FIX: Only the borrower or admin can return
    if book["user_id"] != user["user_id"] and user["role"] != "admin":
        return jsonify({"error": "You did not borrow this book"}), 403

    fine = calculate_fine(book["due_date"])

    with conn:
        # FIX: Clear due_date and user_id on return; record fine separately
        conn.execute(
            "UPDATE books SET available = 1, due_date = NULL, user_id = NULL WHERE id = ?",
            (book_id,)
        )
        if fine > 0:
            conn.execute(
                "INSERT INTO fines (user_id, book_id, amount) VALUES (?, ?, ?)",
                (user["user_id"], book_id, fine)
            )

    return jsonify({
        "message": "Book returned successfully",
        "fine":    fine
    })

@app.route("/delete/<int:book_id>", methods=["DELETE"])
@token_required
@admin_required
def delete_book(user, book_id):
    conn = get_db()
    book = conn.execute("SELECT * FROM books WHERE id = ?", (book_id,)).fetchone()

    if not book:
        return jsonify({"error": "Book not found"}), 404

    # FIX: Don't allow deleting a currently borrowed book
    if not book["available"]:
        return jsonify({"error": "Cannot delete a book that is currently borrowed"}), 400

    with conn:
        conn.execute("DELETE FROM books WHERE id = ?", (book_id,))

    return jsonify({"message": "Book deleted"})

# ─────────────────────────────────────────────
# STATS
# ─────────────────────────────────────────────

@app.route("/stats", methods=["GET"])
@token_required
def stats(user):
    conn = get_db()

    total     = conn.execute("SELECT COUNT(*) FROM books").fetchone()[0]
    borrowed  = conn.execute("SELECT COUNT(*) FROM books WHERE available = 0").fetchone()[0]
    available = conn.execute("SELECT COUNT(*) FROM books WHERE available = 1").fetchone()[0]
    overdue   = conn.execute(
        "SELECT COUNT(*) FROM books WHERE available = 0 AND due_date < date('now')"
    ).fetchone()[0]
    total_users = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
    unpaid_fines = conn.execute(
        "SELECT COALESCE(SUM(amount), 0) FROM fines WHERE paid = 0"
    ).fetchone()[0]

    return jsonify({
        "total":        total,
        "borrowed":     borrowed,
        "available":    available,
        "overdue":      overdue,
        "total_users":  total_users,
        "unpaid_fines": unpaid_fines
    })

# ─────────────────────────────────────────────
# FINES
# ─────────────────────────────────────────────

@app.route("/fines", methods=["GET"])
@token_required
def get_fines(user):
    conn = get_db()

    # Admin sees all fines; student sees only their own
    if user["role"] == "admin":
        rows = conn.execute("""
            SELECT f.id, f.user_id, u.username, f.book_id, b.title,
                   f.amount, f.paid, f.created_at
            FROM fines f
            JOIN users u ON u.id = f.user_id
            JOIN books b ON b.id = f.book_id
            ORDER BY f.created_at DESC
        """).fetchall()
    else:
        rows = conn.execute("""
            SELECT f.id, f.user_id, u.username, f.book_id, b.title,
                   f.amount, f.paid, f.created_at
            FROM fines f
            JOIN users u ON u.id = f.user_id
            JOIN books b ON b.id = f.book_id
            WHERE f.user_id = ?
            ORDER BY f.created_at DESC
        """, (user["user_id"],)).fetchall()

    return jsonify([dict(r) for r in rows])

@app.route("/fines/<int:fine_id>/pay", methods=["POST"])
@token_required
@admin_required
def pay_fine(user, fine_id):
    with get_db() as conn:
        conn.execute("UPDATE fines SET paid = 1 WHERE id = ?", (fine_id,))
    return jsonify({"message": "Fine marked as paid"})

# ─────────────────────────────────────────────
# ADMIN: borrowed books with borrower details
# ─────────────────────────────────────────────

@app.route("/borrowed", methods=["GET"])
@token_required
@admin_required
def borrowed_books(user):
    conn = get_db()
    rows = conn.execute("""
        SELECT b.id, b.title, b.author, b.due_date,
               u.id AS user_id, u.username, u.email
        FROM books b
        JOIN users u ON u.id = b.user_id
        WHERE b.available = 0
        ORDER BY b.due_date ASC
    """).fetchall()

    result = []
    for r in rows:
        fine = calculate_fine(r["due_date"])
        result.append({
            "book_id":  r["id"],
            "title":    r["title"],
            "author":   r["author"],
            "due_date": r["due_date"],
            "overdue":  fine > 0,
            "fine":     fine,
            "user_id":  r["user_id"],
            "username": r["username"],
            "email":    r["email"]
        })

    return jsonify(result)

# ─────────────────────────────────────────────
# SEED (FIX: admin-protected)
# ─────────────────────────────────────────────

@app.route("/seed", methods=["POST"])
@token_required
@admin_required
def seed(user):
    books = [
        ("Atomic Habits",                         "James Clear",         "978-0735211292"),
        ("The Alchemist",                          "Paulo Coelho",        "978-0062315007"),
        ("Rich Dad Poor Dad",                      "Robert Kiyosaki",     "978-1612680194"),
        ("Think and Grow Rich",                    "Napoleon Hill",       "978-1585424337"),
        ("Deep Work",                              "Cal Newport",         "978-1455586691"),
        ("The Power of Now",                       "Eckhart Tolle",       "978-1577314806"),
        ("Ikigai",                                 "Hector Garcia",       "978-0143130727"),
        ("Start With Why",                         "Simon Sinek",         "978-1591846444"),
        ("The 5 AM Club",                          "Robin Sharma",        "978-1443456623"),
        ("The Psychology of Money",                "Morgan Housel",       "978-0857197689"),
        ("Zero to One",                            "Peter Thiel",         "978-0804139021"),
        ("Clean Code",                             "Robert C. Martin",    "978-0132350884"),
        ("You Don't Know JS",                      "Kyle Simpson",        "978-1491924464"),
        ("Eloquent JavaScript",                    "Marijn Haverbeke",    "978-1593279509"),
        ("Introduction to Algorithms",             "Thomas H. Cormen",    "978-0262033848"),
        ("Artificial Intelligence: A Modern Approach", "Stuart Russell",  "978-0134610993"),
        ("The Pragmatic Programmer",               "Andrew Hunt",         "978-0135957059"),
        ("Design Patterns",                        "Erich Gamma",         "978-0201633610"),
        ("Cracking the Coding Interview",          "Gayle McDowell",      "978-0984782857"),
        ("Python Crash Course",                    "Eric Matthes",        "978-1593279288"),
    ]
    with get_db() as conn:
        conn.executemany(
            "INSERT OR IGNORE INTO books (title, author, isbn) VALUES (?, ?, ?)",
            books
        )
        conn.commit()

    return jsonify({"message": f"{len(books)} books seeded (duplicates skipped)"})

# ─────────────────────────────────────────────
# RUN
# ─────────────────────────────────────────────

if __name__ == "__main__":
    app.run(debug=True, port=5000)

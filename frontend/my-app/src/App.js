// src/App.js
import { useEffect, useState } from "react";
import { decodeToken, clearToken, isLoggedIn, getRole } from "./auth";
import { apiGetBooks, apiGetStats, apiBorrowBook, apiReturnBook, apiDeleteBook } from "./api";

import LoginPage    from "./LoginPage";
import StatsBar     from "./StatsBar";
import BookList     from "./BookList";
import AddBookForm  from "./AddBookForm";
import BorrowedList from "./BorrowedList";
import FinesList    from "./FinesList";

import styles from "./App.module.css";

export default function App() {
  const [loggedIn,    setLoggedIn]    = useState(isLoggedIn());
  const [role,        setRole]        = useState(getRole());
  const [currentUserId, setCurrentUserId] = useState(null);

  const [books,   setBooks]   = useState([]);
  const [stats,   setStats]   = useState(null);
  const [search,  setSearch]  = useState("");
  const [loading, setLoading] = useState(false);
  const [tab,     setTab]     = useState("books");   // books | borrowed | fines
  const [toast,   setToast]   = useState("");

  // ── helpers ──────────────────────────────────────────────────────────────

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  const loadBooks = async (q = search) => {
    setLoading(true);
    try {
      const data = await apiGetBooks(q);
      setBooks(Array.isArray(data) ? data : []);
    } catch (e) {
      showToast("Failed to load books.");
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const data = await apiGetStats();
      setStats(data);
    } catch {}
  };

  const refresh = () => { loadBooks(); loadStats(); };

  // ── on login ──────────────────────────────────────────────────────────────

  const handleLogin = (userRole) => {
    const payload = decodeToken();
    setRole(userRole);
    setCurrentUserId(payload?.user_id || null);
    setLoggedIn(true);
  };

  useEffect(() => {
    if (loggedIn) refresh();
  }, [loggedIn]);                // eslint-disable-line react-hooks/exhaustive-deps

  // search with debounce
  useEffect(() => {
    if (!loggedIn) return;
    const t = setTimeout(() => loadBooks(search), 300);
    return () => clearTimeout(t);
  }, [search]);                  // eslint-disable-line react-hooks/exhaustive-deps

  // ── actions ───────────────────────────────────────────────────────────────

  const handleBorrow = async (bookId) => {
    const data = await apiBorrowBook(bookId);
    if (data.error) { showToast(data.error); return; }
    showToast(`Borrowed! Due: ${data.due_date}`);
    refresh();
  };

  const handleReturn = async (bookId) => {
    const data = await apiReturnBook(bookId);
    if (data.error) { showToast(data.error); return; }
    const msg = data.fine > 0
      ? `Returned. Fine: ₹${data.fine}`
      : "Returned successfully!";
    showToast(msg);
    refresh();
  };

  const handleDelete = async (bookId) => {
    if (!window.confirm("Delete this book?")) return;
    const data = await apiDeleteBook(bookId);
    if (data.error) { showToast(data.error); return; }
    showToast("Book deleted.");
    refresh();
  };

  const handleLogout = () => {
    clearToken();
    setLoggedIn(false);
    setRole(null);
    setBooks([]);
    setStats(null);
    setTab("books");
  };

  // ── render ────────────────────────────────────────────────────────────────

  if (!loggedIn) return <LoginPage onLogin={handleLogin} />;

  return (
    <div className={styles.app}>

      {/* ── Navbar ── */}
      <nav className={styles.navbar}>
        <div className={styles.navBrand}>📚 LibraryOS</div>
        <div className={styles.navLinks}>
          <button className={tab === "books"    ? styles.navActive : styles.navLink} onClick={() => setTab("books")}>   Books    </button>
          {role === "admin" && (
            <button className={tab === "borrowed" ? styles.navActive : styles.navLink} onClick={() => setTab("borrowed")}>Borrowed</button>
          )}
          <button className={tab === "fines"    ? styles.navActive : styles.navLink} onClick={() => setTab("fines")}>   Fines    </button>
        </div>
        <div className={styles.navRight}>
          <span className={styles.roleTag}>{role}</span>
          <button className={styles.btnLogout} onClick={handleLogout}>Logout</button>
        </div>
      </nav>

      <div className={styles.content}>

        {/* ── Stats ── */}
        <StatsBar stats={stats} />

        {/* ── Toast ── */}
        {toast && <div className={styles.toast}>{toast}</div>}

        {/* ── Books tab ── */}
        {tab === "books" && (
          <>
            {role === "admin" && (
              <AddBookForm onAdded={refresh} />
            )}

            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>Book Catalog</h3>
                <input
                  className={styles.searchInput}
                  placeholder="Search by title or author…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <BookList
                books={books}
                role={role}
                currentUserId={currentUserId}
                onBorrow={handleBorrow}
                onReturn={handleReturn}
                onDelete={handleDelete}
                loading={loading}
              />
            </div>
          </>
        )}

        {/* ── Borrowed tab (admin) ── */}
        {tab === "borrowed" && role === "admin" && (
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Currently Borrowed Books</h3>
            <BorrowedList />
          </div>
        )}

        {/* ── Fines tab ── */}
        {tab === "fines" && (
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>
              {role === "admin" ? "All Fines" : "My Fines"}
            </h3>
            <FinesList role={role} />
          </div>
        )}

      </div>
    </div>
  );
}

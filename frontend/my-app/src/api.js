// src/api.js
// All API calls in one place. Import from here — never write fetch() in components.

const API = process.env.REACT_APP_API_URL || "http://localhost:5000";

const getHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: localStorage.getItem("token") || ""
});

// ── Auth ─────────────────────────────────────────────────────────────────────

export async function apiLogin(username, password) {
  const res = await fetch(`${API}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });
  return res.json();
}

export async function apiRegister(username, password, email, role) {
  const res = await fetch(`${API}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, email, role })
  });
  return res.json();
}

// ── Books ────────────────────────────────────────────────────────────────────

export async function apiGetBooks(search = "") {
  const url = search ? `${API}/books?q=${encodeURIComponent(search)}` : `${API}/books`;
  const res = await fetch(url, { headers: getHeaders() });
  if (!res.ok) throw new Error("Failed to load books");
  return res.json();
}

export async function apiAddBook(title, author, isbn) {
  const res = await fetch(`${API}/add_book`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ title, author, isbn })
  });
  return res.json();
}

export async function apiBorrowBook(bookId) {
  const res = await fetch(`${API}/borrow/${bookId}`, {
    method: "POST",
    headers: getHeaders()
  });
  return res.json();
}

export async function apiReturnBook(bookId) {
  const res = await fetch(`${API}/return/${bookId}`, {
    method: "POST",
    headers: getHeaders()
  });
  return res.json();
}

export async function apiDeleteBook(bookId) {
  const res = await fetch(`${API}/delete/${bookId}`, {
    method: "DELETE",
    headers: getHeaders()
  });
  return res.json();
}

// ── Stats ────────────────────────────────────────────────────────────────────

export async function apiGetStats() {
  const res = await fetch(`${API}/stats`, { headers: getHeaders() });
  if (!res.ok) throw new Error("Failed to load stats");
  return res.json();
}

// ── Borrowed (admin) ─────────────────────────────────────────────────────────

export async function apiGetBorrowed() {
  const res = await fetch(`${API}/borrowed`, { headers: getHeaders() });
  if (!res.ok) throw new Error("Failed to load borrowed list");
  return res.json();
}

// ── Fines ────────────────────────────────────────────────────────────────────

export async function apiGetFines() {
  const res = await fetch(`${API}/fines`, { headers: getHeaders() });
  if (!res.ok) throw new Error("Failed to load fines");
  return res.json();
}

export async function apiPayFine(fineId) {
  const res = await fetch(`${API}/fines/${fineId}/pay`, {
    method: "POST",
    headers: getHeaders()
  });
  return res.json();
}

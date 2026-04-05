// src/AddBookForm.js  (Admin only)
import { useState } from "react";
import { apiAddBook } from "./api";
import styles from "./App.module.css";

export default function AddBookForm({ onAdded }) {
  const [title,  setTitle]  = useState("");
  const [author, setAuthor] = useState("");
  const [isbn,   setIsbn]   = useState("");
  const [msg,    setMsg]    = useState("");
  const [error,  setError]  = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg(""); setError("");

    const data = await apiAddBook(title.trim(), author.trim(), isbn.trim());
    if (data.error) {
      setError(data.error);
    } else {
      setMsg("Book added successfully!");
      setTitle(""); setAuthor(""); setIsbn("");
      onAdded();
    }
  };

  return (
    <div className={styles.card}>
      <h3 className={styles.cardTitle}>Add New Book</h3>
      {msg   && <div className={styles.successBox}>{msg}</div>}
      {error && <div className={styles.errorBox}>{error}</div>}
      <form onSubmit={handleSubmit} className={styles.inlineForm}>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Title *"
          required
        />
        <input
          value={author}
          onChange={e => setAuthor(e.target.value)}
          placeholder="Author *"
          required
        />
        <input
          value={isbn}
          onChange={e => setIsbn(e.target.value)}
          placeholder="ISBN (optional)"
        />
        <button className={styles.btnPrimary} type="submit">Add Book</button>
      </form>
    </div>
  );
}

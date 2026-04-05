// src/BorrowedList.js  (Admin only)
import { useEffect, useState } from "react";
import { apiGetBorrowed } from "./api";
import styles from "./App.module.css";

export default function BorrowedList() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGetBorrowed()
      .then(setRecords)
      .catch(() => setRecords([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className={styles.loading}>Loading…</p>;
  if (!records.length) return <p className={styles.empty}>No books are currently borrowed.</p>;

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Book</th>
            <th>Author</th>
            <th>Borrowed By</th>
            <th>Email</th>
            <th>Due Date</th>
            <th>Fine</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {records.map(r => (
            <tr key={r.book_id} className={r.overdue ? styles.rowOverdue : ""}>
              <td className={styles.bookTitle}>{r.title}</td>
              <td className={styles.bookAuthor}>{r.author}</td>
              <td>{r.username}</td>
              <td>{r.email}</td>
              <td className={r.overdue ? styles.overdueDateText : ""}>{r.due_date}</td>
              <td>{r.fine > 0 ? <span className={styles.fineText}>₹{r.fine}</span> : "—"}</td>
              <td>
                {r.overdue
                  ? <span className={styles.badgeOverdue}>Overdue</span>
                  : <span className={styles.badgeBorrowed}>Borrowed</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

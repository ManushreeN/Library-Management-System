// src/BookList.js
import styles from "./App.module.css";

function isOverdue(dueDate) {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date();
}

export default function BookList({ books, role, currentUserId, onBorrow, onReturn, onDelete, loading }) {
  if (loading) return <p className={styles.loading}>Loading books…</p>;
  if (!books.length) return <p className={styles.empty}>No books found.</p>;

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>#</th>
            <th>Title</th>
            <th>Author</th>
            <th>ISBN</th>
            <th>Status</th>
            <th>Due Date</th>
            <th>Fine</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {books.map((book, idx) => {
            const overdue   = isOverdue(book.due_date);
            const isMine    = book.user_id === currentUserId;
            const canReturn = isMine || role === "admin";

            return (
              <tr key={book.id} className={overdue ? styles.rowOverdue : ""}>
                <td>{idx + 1}</td>
                <td className={styles.bookTitle}>{book.title}</td>
                <td className={styles.bookAuthor}>{book.author}</td>
                <td className={styles.bookIsbn}>{book.isbn || "—"}</td>
                <td>
                  {book.available
                    ? <span className={styles.badgeAvailable}>Available</span>
                    : <span className={`${styles.badge} ${overdue ? styles.badgeOverdue : styles.badgeBorrowed}`}>
                        {overdue ? "Overdue" : "Borrowed"}
                      </span>
                  }
                </td>
                <td>
                  {book.due_date
                    ? <span className={overdue ? styles.overdueDateText : ""}>{book.due_date}</span>
                    : "—"}
                </td>
                <td>
                  {book.fine > 0
                    ? <span className={styles.fineText}>₹{book.fine}</span>
                    : "—"}
                </td>
                <td className={styles.actionCell}>
                  {book.available && (
                    <button className={styles.btnBorrow} onClick={() => onBorrow(book.id)}>
                      Borrow
                    </button>
                  )}
                  {!book.available && canReturn && (
                    <button className={styles.btnReturn} onClick={() => onReturn(book.id)}>
                      Return
                    </button>
                  )}
                  {role === "admin" && (
                    <button className={styles.btnDelete} onClick={() => onDelete(book.id)}>
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

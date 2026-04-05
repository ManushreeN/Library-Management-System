// src/FinesList.js
import { useEffect, useState } from "react";
import { apiGetFines, apiPayFine } from "./api";
import styles from "./App.module.css";

export default function FinesList({ role }) {
  const [fines,   setFines]   = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    apiGetFines()
      .then(setFines)
      .catch(() => setFines([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handlePay = async (fineId) => {
    await apiPayFine(fineId);
    load();
  };

  if (loading) return <p className={styles.loading}>Loading fines…</p>;
  if (!fines.length) return <p className={styles.empty}>No fines recorded.</p>;

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            {role === "admin" && <th>Student</th>}
            <th>Book</th>
            <th>Amount</th>
            <th>Date</th>
            <th>Status</th>
            {role === "admin" && <th>Action</th>}
          </tr>
        </thead>
        <tbody>
          {fines.map(f => (
            <tr key={f.id}>
              {role === "admin" && <td>{f.username}</td>}
              <td className={styles.bookTitle}>{f.title}</td>
              <td><span className={styles.fineText}>₹{f.amount}</span></td>
              <td>{f.created_at}</td>
              <td>
                {f.paid
                  ? <span className={styles.badgeAvailable}>Paid</span>
                  : <span className={styles.badgeOverdue}>Unpaid</span>}
              </td>
              {role === "admin" && (
                <td>
                  {!f.paid && (
                    <button className={styles.btnReturn} onClick={() => handlePay(f.id)}>
                      Mark Paid
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

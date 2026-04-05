// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
// import '@testing-library/jest-dom';

// src/StatsBar.js
import styles from "./App.module.css";

export default function StatsBar({ stats }) {
  if (!stats) return null;

  const cards = [
    { label: "Total Books",  value: stats.total,        color: "blue"  },
    { label: "Available",    value: stats.available,    color: "green" },
    { label: "Borrowed",     value: stats.borrowed,     color: "amber" },
    { label: "Overdue",      value: stats.overdue,      color: "red"   },
    { label: "Unpaid Fines", value: `₹${stats.unpaid_fines || 0}`, color: "red" },
  ];

  return (
    <div className={styles.statsGrid}>
      {cards.map(c => (
        <div key={c.label} className={`${styles.statCard} ${styles[`stat_${c.color}`]}`}>
          <div className={styles.statLabel}>{c.label}</div>
          <div className={styles.statVal}>{c.value}</div>
        </div>
      ))}
    </div>
  );
}

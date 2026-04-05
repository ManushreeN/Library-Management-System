// src/LoginPage.js
import { useState } from "react";
import { apiLogin, apiRegister } from "./api";
import { saveToken } from "./auth";
import styles from "./App.module.css";

export default function LoginPage({ onLogin }) {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername]     = useState("");
  const [password, setPassword]     = useState("");
  const [email, setEmail]           = useState("");
  const [role, setRole]             = useState("user");
  const [error, setError]           = useState("");
  const [loading, setLoading]       = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isRegister) {
        const data = await apiRegister(username, password, email, role);
        if (data.error) {
          setError(data.error);
        } else {
          setError("");
          alert("Registered successfully! Please log in.");
          setIsRegister(false);
        }
      } else {
        const data = await apiLogin(username, password);
        if (data.token) {
          saveToken(data.token);
          onLogin(data.role);
        } else {
          setError(data.error || "Login failed");
        }
      }
    } catch {
      setError("Network error — is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.authWrap}>
      <div className={styles.authCard}>
        <div className={styles.authLogo}>📚</div>
        <h2 className={styles.authTitle}>
          {isRegister ? "Create account" : "Sign in"}
        </h2>
        <p className={styles.authSub}>Library Management System</p>

        {error && <div className={styles.errorBox}>{error}</div>}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formRow}>
            <label>Username</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Enter username"
              required
            />
          </div>

          <div className={styles.formRow}>
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter password"
              required
            />
          </div>

          {isRegister && (
            <>
              <div className={styles.formRow}>
                <label>Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                />
              </div>

              <div className={styles.formRow}>
                <label>Role</label>
                <select value={role} onChange={e => setRole(e.target.value)}>
                  <option value="user">Student / User</option>
                  <option value="admin">Admin (Librarian)</option>
                </select>
              </div>
            </>
          )}

          <button className={styles.btnPrimary} type="submit" disabled={loading}>
            {loading ? "Please wait…" : isRegister ? "Register" : "Login"}
          </button>
        </form>

        <button
          className={styles.btnLink}
          onClick={() => { setIsRegister(!isRegister); setError(""); }}
        >
          {isRegister ? "Already have an account? Sign in" : "New user? Create account"}
        </button>
      </div>
    </div>
  );
}

// src/auth.js
// Helpers for storing and reading the JWT token from localStorage.

export function saveToken(token) {
  localStorage.setItem("token", token);
}

export function getToken() {
  return localStorage.getItem("token");
}

export function clearToken() {
  localStorage.removeItem("token");
}

/**
 * Decode the JWT payload (client-side only, NOT for security checks).
 * Returns { user_id, role, exp } or null if token is missing/malformed.
 */
export function decodeToken() {
  const token = getToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    // Check local expiry
    if (payload.exp && Date.now() / 1000 > payload.exp) {
      clearToken();
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function isLoggedIn() {
  return decodeToken() !== null;
}

export function getRole() {
  const payload = decodeToken();
  return payload ? payload.role : null;
}

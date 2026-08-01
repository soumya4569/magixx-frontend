/**
 * auth.js
 * Centralized authentication storage management & session cleanup utilities.
 */

/**
 * Retrieve active JWT authentication token from localStorage or sessionStorage.
 * @returns {string | null} JWT token or null
 */
export const getAuthToken = () => {
  let token =
    localStorage.getItem('token') ||
    localStorage.getItem('pos_auth_token') ||
    sessionStorage.getItem('token') ||
    sessionStorage.getItem('pos_auth_token');

  if (!token) {
    try {
      const user = JSON.parse(
        localStorage.getItem('userInfo') ||
        localStorage.getItem('pos_active_user') ||
        sessionStorage.getItem('userInfo') ||
        sessionStorage.getItem('pos_active_user') ||
        '{}'
      );
      token = user.token || user.jwt || null;
    } catch {
      token = null;
    }
  }

  if (token && typeof token === 'string' && token.trim().length > 0) {
    return token.trim().replace(/^Bearer\s+/i, '');
  }
  return null;
};

/**
 * Aggressively clear all storage persistence layers simultaneously:
 * localStorage, sessionStorage, document.cookie, and IndexedDB databases.
 * Compatible across browser and Electron desktop environments.
 */
export const clearAuthSession = () => {
  // 1. Wipe localStorage completely
  try {
    localStorage.clear();
  } catch (e) {
    console.warn('[Auth] Failed to clear localStorage:', e);
  }

  // 2. Wipe sessionStorage completely
  try {
    sessionStorage.clear();
  } catch (e) {
    console.warn('[Auth] Failed to clear sessionStorage:', e);
  }

  // 3. Purge all document cookies across paths & domains
  try {
    const cookies = document.cookie ? document.cookie.split(';') : [];
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i];
      const eqPos = cookie.indexOf('=');
      const name = eqPos > -1 ? cookie.substring(0, eqPos).trim() : cookie.trim();
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${window.location.hostname}`;
    }
  } catch (e) {
    console.warn('[Auth] Failed to clear cookies:', e);
  }

  // 4. Delete IndexedDB databases if supported by browser/Electron environment
  try {
    if (window.indexedDB && typeof window.indexedDB.databases === 'function') {
      window.indexedDB.databases().then((dbs) => {
        if (dbs && Array.isArray(dbs)) {
          dbs.forEach((db) => {
            if (db.name) window.indexedDB.deleteDatabase(db.name);
          });
        }
      }).catch(() => {});
    }
  } catch (e) {
    console.warn('[Auth] Failed to clear IndexedDB:', e);
  }

  // 5. Notify reactive storage event listeners
  try {
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new Event('pos_user_updated'));
  } catch { /* ignore */ }
};

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
 * Explicitly clear all authentication tokens, session data, and active user roles
 * from both localStorage and sessionStorage.
 */
export const clearAuthSession = () => {
  const keysToRemove = [
    'token',
    'pos_auth_token',
    'pos_active_user',
    'userInfo',
  ];

  keysToRemove.forEach((key) => {
    try {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    } catch (e) {
      console.warn(`Failed to remove ${key} from storage:`, e);
    }
  });

  // Dispatch storage event to notify all reactive listeners
  try {
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new Event('pos_user_updated'));
  } catch { /* ignore */ }
};

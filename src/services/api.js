import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://magixx-backend.onrender.com/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Automatically attach JWT token from localStorage/sessionStorage to outgoing requests
api.interceptors.request.use(
  (config) => {
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
      const cleanToken = token.trim().replace(/^Bearer\s+/i, '');
      config.headers.Authorization = `Bearer ${cleanToken}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor: Handle global errors / unauthorized requests
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      console.warn('Unauthorized request (401) - Expired or invalid token. Redirecting to login...');
      
      // Clear invalid auth session keys
      localStorage.removeItem('token');
      localStorage.removeItem('pos_auth_token');
      localStorage.removeItem('pos_active_user');
      localStorage.removeItem('userInfo');
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('pos_auth_token');
      sessionStorage.removeItem('pos_active_user');
      sessionStorage.removeItem('userInfo');

      // Redirect user cleanly to sign-in page if not on login/landing page
      const currentPath = window.location.pathname;
      if (currentPath !== '/login' && currentPath !== '/' && currentPath !== '/common/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;

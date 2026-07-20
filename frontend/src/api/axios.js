import axios from 'axios';

// For development: uses Vite proxy to forward to backend (default: '/api')
// For production: reads VITE_API_URL from environment variables (e.g., https://api.yourdomain.com)
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - attach JWT token
api.interceptors.request.use(
  (config) => {
    let role = 'student';
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      if (path.startsWith('/admin')) {
        role = 'admin';
      } else if (path.startsWith('/staff')) {
        role = 'staff';
      }
    }
    const token = localStorage.getItem(`${role}_accessToken`) || localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });

  failedQueue = [];
};

// Response interceptor - handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    let role = 'student';
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      if (path.startsWith('/admin')) role = 'admin';
      else if (path.startsWith('/staff')) role = 'staff';
    }

    // Handle 403 role mismatch errors
    if (error.response?.status === 403 && error.response?.data?.message === 'You do not have permission to access this resource.') {
      localStorage.removeItem(`${role}_accessToken`);
      localStorage.removeItem(`${role}_refreshToken`);
      localStorage.removeItem(`${role}_user`);
      
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      
      window.location.href = '/login';
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry && !originalRequest.url.includes('/auth/login') && !originalRequest.url.includes('/auth/refresh')) {
      if (isRefreshing) {
        return new Promise(function(resolve, reject) {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers.Authorization = 'Bearer ' + token;
          return api(originalRequest);
        }).catch(err => {
          return Promise.reject(err);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem(`${role}_refreshToken`) || localStorage.getItem('refreshToken');

      if (refreshToken) {
        try {
          const { data } = await axios.post('/api/auth/refresh', { refreshToken });
          const newToken = data.data.accessToken;
          localStorage.setItem(`${role}_accessToken`, newToken);
          localStorage.setItem('accessToken', newToken);
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          processQueue(null, newToken);
          isRefreshing = false;
          return api(originalRequest);
        } catch (err) {
          processQueue(err, null);
          isRefreshing = false;

          // Only force logout if the server explicitly rejected the refresh token (400 or 401)
          if (err.response?.status === 401 || err.response?.status === 400) {
            localStorage.removeItem(`${role}_accessToken`);
            localStorage.removeItem(`${role}_refreshToken`);
            localStorage.removeItem(`${role}_user`);
            
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('user');
            
            window.location.href = '/login';
          }
          return Promise.reject(err);
        }
      } else {
        localStorage.removeItem(`${role}_accessToken`);
        localStorage.removeItem(`${role}_refreshToken`);
        localStorage.removeItem(`${role}_user`);
        
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

export default api;

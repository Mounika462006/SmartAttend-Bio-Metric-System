import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI } from '../api/services';

const AuthContext = createContext(null);

const getCurrentRoleFromURL = () => {
  if (typeof window === 'undefined') return null;
  const path = window.location.pathname;
  if (path.startsWith('/admin')) return 'admin';
  if (path.startsWith('/staff')) return 'staff';
  if (path.startsWith('/student')) return 'student';
  return null;
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Initialize from localStorage
  useEffect(() => {
    const urlRole = getCurrentRoleFromURL();
    const rolesToTry = urlRole ? [urlRole] : ['student', 'staff', 'admin'];
    let foundUser = null;

    for (const r of rolesToTry) {
      const storedUser = localStorage.getItem(`${r}_user`);
      const accessToken = localStorage.getItem(`${r}_accessToken`);
      if (storedUser && accessToken) {
        try {
          foundUser = JSON.parse(storedUser);
          break;
        } catch {
          localStorage.removeItem(`${r}_user`);
          localStorage.removeItem(`${r}_accessToken`);
          localStorage.removeItem(`${r}_refreshToken`);
        }
      }
    }

    // Fallback to legacy single keys if no role-scoped keys found
    if (!foundUser) {
      const legacyUser = localStorage.getItem('user');
      const legacyToken = localStorage.getItem('accessToken');
      if (legacyUser && legacyToken) {
        try {
          const parsed = JSON.parse(legacyUser);
          if (parsed.role) {
            localStorage.setItem(`${parsed.role}_user`, legacyUser);
            localStorage.setItem(`${parsed.role}_accessToken`, legacyToken);
            const legacyRefresh = localStorage.getItem('refreshToken');
            if (legacyRefresh) {
              localStorage.setItem(`${parsed.role}_refreshToken`, legacyRefresh);
            }
            foundUser = parsed;
          }
        } catch {
          localStorage.clear();
        }
      }
    }

    setUser(foundUser);
    setLoading(false);
  }, []);

  const login = useCallback(async (email, password, role) => {
    const { data } = await authAPI.login({ email, password, role });
    const { user: userData, accessToken, refreshToken } = data.data;
    
    // Store in role-scoped keys
    localStorage.setItem(`${role}_accessToken`, accessToken);
    localStorage.setItem(`${role}_refreshToken`, refreshToken);
    localStorage.setItem(`${role}_user`, JSON.stringify(userData));
    
    // Also store legacy keys for compatibility
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('user', JSON.stringify(userData));
    
    setUser(userData);
    return userData;
  }, []);

  const logout = useCallback(async () => {
    const activeRole = user?.role || getCurrentRoleFromURL();
    try {
      await authAPI.logout();
    } catch {}
    
    if (activeRole) {
      localStorage.removeItem(`${activeRole}_accessToken`);
      localStorage.removeItem(`${activeRole}_refreshToken`);
      localStorage.removeItem(`${activeRole}_user`);
    }
    
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    
    setUser(null);
  }, [user]);

  const updateUser = useCallback((updatedData) => {
    setUser(prevUser => {
      if (!prevUser) return null;
      const updated = { ...prevUser, ...updatedData };
      const role = updated.role || getCurrentRoleFromURL();
      if (role) {
        localStorage.setItem(`${role}_user`, JSON.stringify(updated));
      }
      localStorage.setItem('user', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const value = {
    user,
    loading,
    isAuthenticated: !!user,
    role: user?.role,
    login,
    logout,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

import React, { useState, useEffect, createContext, useContext } from 'react';
import PublicPortal from './pages/PublicPortal';
import StudentForm from './pages/StudentForm';
import SuccessPage from './pages/SuccessPage';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';

// --- CONTEXT: TOAST NOTIFICATIONS ---
const ToastContext = createContext(null);

export function useToast() {
  return useContext(ToastContext);
}

function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const showToast = (message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="toast-container no-print" aria-live="polite">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type}`}>
            <span className="toast-message">{t.message}</span>
            <button className="toast-close" onClick={() => removeToast(t.id)} aria-label="Close message">×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// --- CONTEXT: ADMIN AUTH ---
const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem('gvp_admin_token') || null);
  const [admin, setAdmin] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('gvp_admin_user') || 'null');
    } catch (e) {
      return null;
    }
  });

  const login = (newToken, adminUser) => {
    localStorage.setItem('gvp_admin_token', newToken);
    localStorage.setItem('gvp_admin_user', JSON.stringify(adminUser));
    setToken(newToken);
    setAdmin(adminUser);
  };

  const logout = async () => {
    if (token) {
      try {
        await fetch('/api/admin/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
      } catch (err) {
        console.error('Logout log error:', err);
      }
    }
    localStorage.removeItem('gvp_admin_token');
    localStorage.removeItem('gvp_admin_user');
    setToken(null);
    setAdmin(null);
  };

  const fetchWithAuth = (url, options = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return fetch(url, { ...options, headers }).then(async res => {
      if (res.status === 401 || res.status === 403) {
        // Auto logout if token expires
        localStorage.removeItem('gvp_admin_token');
        localStorage.removeItem('gvp_admin_user');
        setToken(null);
        setAdmin(null);
        throw new Error('Session expired. Please login again.');
      }
      return res;
    });
  };

  return (
    <AuthContext.Provider value={{ token, admin, login, logout, fetchWithAuth, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
}

// --- APP COMPONENT WITH CUSTOM ROUTING ---
export default function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  // Sync state with popstate (back/forward browser buttons)
  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname);
    };

    window.addEventListener('popstate', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
    };
  }, []);

  // Custom navigate function
  const navigate = (path, state = {}) => {
    window.history.pushState(state, '', path);
    setCurrentPath(path);
    window.scrollTo(0, 0);
  };

  // Route dispatcher
  const renderRoute = () => {
    if (currentPath === '/') {
      return <PublicPortal navigate={navigate} />;
    }
    
    if (currentPath === '/apply') {
      return <StudentForm navigate={navigate} />;
    }
    
    if (currentPath === '/success') {
      const state = window.history.state || {};
      return <SuccessPage navigate={navigate} applicationData={state} />;
    }
    
    if (currentPath === '/gvpadmin') {
      return (
        <AdminWrapper navigate={navigate} />
      );
    }

    // Default 404 handler, redirects to root
    return <PublicPortal navigate={navigate} />;
  };

  return (
    <ToastProvider>
      <AuthProvider>
        <div className="app-container">
          {renderRoute()}
        </div>
      </AuthProvider>
    </ToastProvider>
  );
}

// Separate component to handle admin auth redirection cleanly
function AdminWrapper({ navigate }) {
  const { isAuthenticated } = useAuth();
  
  if (!isAuthenticated) {
    return <AdminLogin navigate={navigate} />;
  }

  return <AdminDashboard navigate={navigate} />;
}

import React, { createContext, useContext, useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { Car, LogOut, Key } from 'lucide-react';

// Import Pages
import Home from './pages/Home';
import FindParking from './pages/FindParking';
import ShopPortal from './pages/ShopPortal';
import AdminPortal from './pages/AdminPortal';
import MyBookings from './pages/MyBookings';

// Auth Interface
export interface User {
  id: number;
  email: string;
  name: string;
  role: string;  // customer, owner, admin
  phone?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const savedToken = localStorage.getItem('park0_token');
    const savedUser = localStorage.getItem('park0_user');
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
  }, []);

  const login = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('park0_token', newToken);
    localStorage.setItem('park0_user', JSON.stringify(newUser));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('park0_token');
    localStorage.removeItem('park0_user');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// Navbar Component
const NavigationBar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="navbar">
      <div className="logo" onClick={() => navigate('/')}>
        <Car size={26} className="text-primary" />
        <span>Park<span style={{ color: 'var(--primary)' }}>0</span></span>
      </div>

      <ul className="nav-links">
        <li>
          <Link to="/" className={`nav-link ${isActive('/') ? 'active' : ''}`}>Home</Link>
        </li>
        <li>
          <Link to="/find-parking" className={`nav-link ${isActive('/find-parking') ? 'active' : ''}`}>Find Parking</Link>
        </li>
        {user && user.role === 'customer' && (
          <li>
            <Link to="/my-bookings" className={`nav-link ${isActive('/my-bookings') ? 'active' : ''}`}>My Bookings</Link>
          </li>
        )}
        {user && user.role === 'owner' && (
          <li>
            <Link to="/shop-portal" className={`nav-link ${isActive('/shop-portal') ? 'active' : ''}`}>Shop Owner Portal</Link>
          </li>
        )}
        {user && user.role === 'admin' && (
          <li>
            <Link to="/admin-portal" className={`nav-link ${isActive('/admin-portal') ? 'active' : ''}`}>Admin Portal</Link>
          </li>
        )}
      </ul>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        {user ? (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{user.name}</span>
              <span className="badge badge-green" style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem', textTransform: 'capitalize' }}>
                {user.role}
              </span>
            </div>
            <button onClick={handleLogout} className="btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}>
              <LogOut size={16} />
              Logout
            </button>
          </>
        ) : (
          <Link to="/" className="btn-primary" style={{ padding: '0.5rem 1.2rem', fontSize: '0.9rem' }}>
            <Key size={16} />
            Login / Portal
          </Link>
        )}
      </div>
    </nav>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <NavigationBar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/find-parking" element={<FindParking />} />
          <Route path="/my-bookings" element={<MyBookings />} />
          <Route path="/shop-portal" element={<ShopPortal />} />
          <Route path="/admin-portal" element={<AdminPortal />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
};

export default App;

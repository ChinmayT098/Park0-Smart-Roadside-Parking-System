import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { Shield, Sparkles, Navigation, DollarSign, Camera, CheckCircle, HelpCircle, Search, Car } from 'lucide-react';

const Home: React.FC = () => {
  const { user, login } = useAuth();
  const navigate = useNavigate();

  // Authentication states
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('customer'); // customer, owner, admin
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Search input state
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(`/find-parking?q=${encodeURIComponent(searchQuery)}`);
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const body = isLogin 
        ? { email, password } 
        : { email, password, name, role };

      const response = await fetch(`http://127.0.0.1:8000${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Authentication failed');
      }

      if (isLogin) {
        login(data.access_token, data.user);
        if (data.user.role === 'owner') navigate('/shop-portal');
        else if (data.user.role === 'admin') navigate('/admin-portal');
        else navigate('/find-parking');
      } else {
        // Automatically log in after successful registration
        const loginResponse = await fetch('http://127.0.0.1:8000/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        const loginData = await loginResponse.json();
        if (loginResponse.ok) {
          login(loginData.access_token, loginData.user);
          if (loginData.user.role === 'owner') navigate('/shop-portal');
          else if (loginData.user.role === 'admin') navigate('/admin-portal');
          else navigate('/find-parking');
        } else {
          setIsLogin(true);
          setError('Registration successful! Please login.');
        }
      }
    } catch (err: any) {
      console.error(err);
      // If the error is a connection failure (backend down), allow mock fallback login
      if (err.message.includes('Failed to fetch') || err.message.includes('fetch failed') || err.message.includes('NetworkError')) {
        const fallbackUser = {
          id: Math.floor(Math.random() * 1000),
          email: email || 'user@park0.com',
          name: name || (role === 'owner' ? 'Metro Parking Inc.' : role === 'admin' ? 'Super Admin' : 'Sumit Sharma'),
          role: role
        };
        login('mock_token_123', fallbackUser);
        if (role === 'owner') navigate('/shop-portal');
        else if (role === 'admin') navigate('/admin-portal');
        else navigate('/find-parking');
      } else {
        // Display real database validation errors (e.g., incorrect password, duplicate email)
        setError(err.message || 'Authentication failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleMockLogin = () => {
    // Quick google oauth bypass simulation
    const mockUser = {
      id: 999,
      email: 'google.user@gmail.com',
      name: 'Google User',
      role: 'customer'
    };
    login('google_mock_token', mockUser);
    navigate('/find-parking');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* HERO SECTION */}
      <section style={{ 
        position: 'relative', 
        padding: '8rem 5% 6rem 5%', 
        background: 'radial-gradient(circle at 80% 20%, rgba(37, 99, 235, 0.06) 0%, transparent 50%)',
        display: 'grid',
        gridTemplateColumns: '1.2fr 0.8fr',
        gap: '4rem',
        alignItems: 'center'
      }} className="animate-fade-in">
        
        <div>
          <div className="badge badge-yellow" style={{ marginBottom: '1.5rem', gap: '0.4rem' }}>
            <Sparkles size={14} />
            AI-Powered Roadside Length Bookings
          </div>
          
          <h1 style={{ fontSize: '3.6rem', lineHeight: '1.1', marginBottom: '1.5rem', fontWeight: 800 }}>
            Find & Book Parking Near You <span style={{ background: 'var(--gradient-main)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Instantly</span>
          </h1>
          
          <p style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', marginBottom: '2.5rem', maxWidth: '600px' }}>
            Park0 manages parking spots outside roadside shops by physical length (meters) rather than fixed boxes. Real-time cameras compute availability in seconds.
          </p>

          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.8rem', maxWidth: '600px', marginBottom: '2rem' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} size={20} />
              <input 
                type="text" 
                placeholder="Search by location, shop name or landmark..." 
                className="glass-input"
                style={{ paddingLeft: '3rem' }}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button type="submit" className="btn-primary">
              <Navigation size={18} />
              Find Parking
            </button>
          </form>

          <div style={{ display: 'flex', gap: '2rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckCircle size={16} className="text-primary" /> Live AI webcam logs
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckCircle size={16} className="text-primary" /> UPI & Razorpay sandbox
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckCircle size={16} className="text-primary" /> Multi-portal system
            </div>
          </div>
        </div>

        {/* AUTH PANEL / PORTAL ACCESS */}
        <div className="glass-card" style={{ padding: '2.5rem', border: '1px solid rgba(37, 99, 235, 0.15)' }}>
          {user ? (
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <Shield size={48} style={{ color: 'var(--primary)', marginBottom: '1rem' }} />
              <h3 style={{ marginBottom: '0.5rem', fontSize: '1.4rem' }}>Welcome Back, {user.name}!</h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>You are logged in as a {user.role}.</p>
              
              {user.role === 'customer' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                  <button onClick={() => navigate('/find-parking')} className="btn-primary" style={{ justifyContent: 'center' }}>
                    Go to Parking Map
                  </button>
                  <button onClick={() => navigate('/my-bookings')} className="btn-secondary" style={{ justifyContent: 'center' }}>
                    My Active Bookings
                  </button>
                </div>
              )}

              {user.role === 'owner' && (
                <button onClick={() => navigate('/shop-portal')} className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                  Open Shop Dashboard
                </button>
              )}

              {user.role === 'admin' && (
                <button onClick={() => navigate('/admin-portal')} className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                  Open Administrator Panel
                </button>
              )}
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-around', borderBottom: '1px solid var(--border-glass)', marginBottom: '1.5rem', paddingBottom: '0.5rem' }}>
                <button 
                  onClick={() => setIsLogin(true)} 
                  style={{ background: 'none', border: 'none', color: isLogin ? 'var(--primary)' : 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer', fontSize: '1.1rem' }}
                >
                  Login
                </button>
                <button 
                  onClick={() => setIsLogin(false)} 
                  style={{ background: 'none', border: 'none', color: !isLogin ? 'var(--primary)' : 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer', fontSize: '1.1rem' }}
                >
                  Register
                </button>
              </div>

              {error && <div style={{ color: 'var(--color-red)', fontSize: '0.85rem', marginBottom: '1rem', background: 'var(--color-red-glow)', padding: '0.5rem', borderRadius: '4px', textAlign: 'center' }}>{error}</div>}

              <form onSubmit={handleAuthSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {!isLogin && (
                  <div>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Full Name</label>
                    <input 
                      type="text" 
                      required 
                      className="glass-input" 
                      placeholder="Enter your name" 
                      value={name} 
                      onChange={(e) => setName(e.target.value)} 
                    />
                  </div>
                )}
                
                <div>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Email Address</label>
                  <input 
                    type="email" 
                    required 
                    className="glass-input" 
                    placeholder="you@domain.com" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Password</label>
                  <input 
                    type="password" 
                    required 
                    className="glass-input" 
                    placeholder="••••••••" 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                  />
                </div>

                {!isLogin && (
                  <div>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Portal Role</label>
                    <select 
                      className="glass-input" 
                      value={role} 
                      onChange={(e) => setRole(e.target.value)}
                      style={{ background: 'var(--bg-deep)' }}
                    >
                      <option value="customer">Customer (Book Parking)</option>
                      <option value="owner">Shop Owner (Manage Camera)</option>
                      <option value="admin">Administrator (Audit system)</option>
                    </select>
                  </div>
                )}

                <button type="submit" disabled={loading} className="btn-primary" style={{ justifyContent: 'center', marginTop: '0.5rem' }}>
                  {loading ? 'Please wait...' : isLogin ? 'Sign In' : 'Create Account'}
                </button>
              </form>

              <div style={{ display: 'flex', alignItems: 'center', margin: '1.5rem 0' }}>
                <div style={{ flex: 1, height: '1px', background: 'var(--border-glass)' }}></div>
                <span style={{ padding: '0 0.8rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>OR CONTINUE WITH</span>
                <div style={{ flex: 1, height: '1px', background: 'var(--border-glass)' }}></div>
              </div>

              <button onClick={handleGoogleMockLogin} className="btn-secondary" style={{ width: '100%', justifyContent: 'center' }}>
                <svg style={{ width: '18px', height: '18px' }} viewBox="0 0 24 24">
                  <path fill="#EA4335" d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.67 1.47 15.01.6 12 .6 7.42.6 3.53 3.24 1.7 7.08l3.96 3.07C6.6 6.94 9.07 5.04 12 5.04z"/>
                  <path fill="#4285F4" d="M23.49 12.27c0-.83-.07-1.63-.2-2.4H12v4.56h6.48c-.28 1.48-1.12 2.74-2.38 3.59l3.7 2.87c2.16-2 3.4-4.94 3.4-8.62z"/>
                  <path fill="#FBBC05" d="M5.66 10.15c-.24-.71-.38-1.47-.38-2.27s.14-1.56.38-2.27L1.7 4.54C.62 6.7.01 9.17.01 11.88s.61 5.18 1.69 7.34l3.96-3.07z"/>
                  <path fill="#34A853" d="M12 23.4c3.24 0 5.97-1.07 7.96-2.91l-3.7-2.87c-1.03.69-2.35 1.1-3.96 1.1-2.93 0-5.4-1.9-6.3-4.79l-3.96 3.07c1.83 3.84 5.72 6.4 10.3 6.4z"/>
                </svg>
                Sign in with Google
              </button>
            </div>
          )}
        </div>
      </section>

      {/* HOW IT WORKS SECTION */}
      <section style={{ padding: '6rem 5%', background: '#FAFAFA', borderTop: '1px solid var(--border-glass)', borderBottom: '1px solid var(--border-glass)' }}>
        <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
          <h2 style={{ fontSize: '2.4rem', marginBottom: '1rem' }}>How Park0 Works</h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto' }}>
            A unified IoT framework bringing roadside space allocation into the AI age.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem' }}>
          <div className="glass-card" style={{ textAlign: 'center', padding: '2rem' }}>
            <div style={{ width: '50px', height: '50px', background: 'var(--primary-glow)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto', color: 'var(--primary)' }}>
              <DollarSign size={24} />
            </div>
            <h3 style={{ marginBottom: '0.8rem' }}>1. Shops Monetize Space</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Shop owners register their street frontage total length (e.g., 50 meters) and set hourly parking rates.
            </p>
          </div>

          <div className="glass-card" style={{ textAlign: 'center', padding: '2rem' }}>
            <div style={{ width: '50px', height: '50px', background: 'var(--secondary-glow)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto', color: 'var(--secondary)' }}>
              <Camera size={24} />
            </div>
            <h3 style={{ marginBottom: '0.8rem' }}>2. AI Computes Length</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Our YOLOv8 model scans the space via webcam, calculates vehicle lengths (e.g. Car=4.5m, SUV=5m), and updates real-time availability.
            </p>
          </div>

          <div className="glass-card" style={{ textAlign: 'center', padding: '2rem' }}>
            <div style={{ width: '50px', height: '50px', background: 'rgba(16, 185, 129, 0.2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto', color: 'var(--color-green)' }}>
              <Navigation size={24} />
            </div>
            <h3 style={{ marginBottom: '0.8rem' }}>3. Instantly Reserve</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Customers look up live pricing, choose their vehicle length, make UPI/Razorpay mock payment, and route straight to the spot.
            </p>
          </div>
        </div>
      </section>

      {/* CORE FEATURES */}
      <section style={{ padding: '6rem 5%' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4rem', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '2.5rem', marginBottom: '1.5rem', lineHeight: '1.2' }}>
              Length-Based Allocations: The Smart City Standard
            </h2>
            
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
              Traditional parking is limited by slots. Park0 recognizes that roads are continuous resources. An auto-rickshaw takes half the length of a SUV. Why charge them the same, or deny parking when a slot is mismatching?
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <CheckCircle className="text-primary" style={{ flexShrink: 0 }} />
                <div>
                  <h4 style={{ fontSize: '1.1rem', marginBottom: '0.2rem' }}>Automatic vehicle classification</h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>AI detects cars, SUVs, bikes, scooters, auto rickshaws, and vans.</p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <CheckCircle className="text-primary" style={{ flexShrink: 0 }} />
                <div>
                  <h4 style={{ fontSize: '1.1rem', marginBottom: '0.2rem' }}>Instant updates over Websockets</h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Whenever a vehicle enters or exits, the customer booking page updates in real-time.</p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <CheckCircle className="text-primary" style={{ flexShrink: 0 }} />
                <div>
                  <h4 style={{ fontSize: '1.1rem', marginBottom: '0.2rem' }}>Seamless payment settlement</h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Direct wallet distribution allows shop owners to withdraw accumulated earnings securely.</p>
                </div>
              </div>
            </div>
          </div>

          <div style={{ position: 'relative' }}>
            {/* Visual AI box prototype graphic */}
            <div className="glass-card" style={{ padding: '1rem', border: '1px solid var(--border-glass)' }}>
              <div style={{ background: '#E2E8F0', height: '280px', borderRadius: '8px', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-glass)' }}>
                {/* Simulated frame overlay */}
                <div style={{ position: 'absolute', top: '10px', left: '10px', fontSize: '0.75rem', color: 'var(--color-green)', background: 'rgba(15, 23, 42, 0.85)', padding: '2px 8px', borderRadius: '4px' }}>
                  CAMERA: ONLINE | AI ENGAGED
                </div>
                
                {/* Drawn vehicles representation */}
                <div style={{ position: 'absolute', border: '2px solid var(--primary)', left: '10%', top: '35%', width: '180px', height: '110px', padding: '4px', color: 'var(--primary)' }}>
                  <div style={{ fontSize: '0.65rem', background: 'var(--primary)', color: 'white', padding: '1px 4px', width: 'fit-content', borderRadius: '2px' }}>
                    Car: 4.5m (95%)
                  </div>
                </div>

                <div style={{ position: 'absolute', border: '2px solid var(--secondary)', left: '55%', top: '45%', width: '70px', height: '70px', padding: '4px', color: 'var(--secondary)' }}>
                  <div style={{ fontSize: '0.65rem', background: 'var(--secondary)', color: 'white', padding: '1px 4px', width: 'fit-content', borderRadius: '2px' }}>
                    Bike: 2.0m (88%)
                  </div>
                </div>

                {/* Road graphic lines */}
                <div style={{ position: 'absolute', bottom: '15%', left: 0, right: 0, height: '4px', background: 'rgba(37, 99, 235, 0.2)' }}></div>
                <div style={{ color: '#64748B', fontSize: '0.85rem', fontWeight: 500 }}>AI camera view mockup</div>
              </div>

              {/* Status bar */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginTop: '1rem', textAlign: 'center', fontSize: '0.8rem' }}>
                <div style={{ background: '#FFFFFF', border: '1px solid var(--border-glass)', padding: '0.5rem', borderRadius: '8px', boxShadow: 'var(--shadow-glass)' }}>
                  <div style={{ color: 'var(--text-secondary)' }}>Occupied</div>
                  <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>6.5m</strong>
                </div>
                <div style={{ background: '#FFFFFF', border: '1px solid var(--border-glass)', padding: '0.5rem', borderRadius: '8px', boxShadow: 'var(--shadow-glass)' }}>
                  <div style={{ color: 'var(--text-secondary)' }}>Remaining</div>
                  <strong style={{ fontSize: '1rem', color: 'var(--color-green)' }}>43.5m</strong>
                </div>
                <div style={{ background: '#FFFFFF', border: '1px solid var(--border-glass)', padding: '0.5rem', borderRadius: '8px', boxShadow: 'var(--shadow-glass)' }}>
                  <div style={{ color: 'var(--text-secondary)' }}>Vehicle Count</div>
                  <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>2</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ SECTION */}
      <section style={{ padding: '6rem 5%', background: '#FAFAFA', borderTop: '1px solid var(--border-glass)', borderBottom: '1px solid var(--border-glass)' }}>
        <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
          <h2 style={{ fontSize: '2.4rem', marginBottom: '1rem' }}>Frequently Asked Questions</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Got questions? We have answers.</p>
        </div>

        <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="glass-card">
            <h4 style={{ fontSize: '1.2rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <HelpCircle size={18} className="text-primary" /> How does length-based booking work?
            </h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
              When you book, you select your vehicle type (e.g. SUV, bike). We deduct the corresponding length from the shop's total roadside length. The system only confirms the booking if that remaining length is free.
            </p>
          </div>

          <div className="glass-card">
            <h4 style={{ fontSize: '1.2rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <HelpCircle size={18} className="text-primary" /> What if the remaining length is full but slots are free?
            </h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
              Park0 doesn't have slots! If the camera detects that cars have parked sub-optimally and taken up too much physical space, the remaining length is dynamically calculated. If the space is insufficient, the system prevents double bookings and suggests nearby locations.
            </p>
          </div>

          <div className="glass-card">
            <h4 style={{ fontSize: '1.2rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <HelpCircle size={18} className="text-primary" /> Can I use my phone's camera or a CCTV?
            </h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
              Yes! For this prototype, the dashboard connects directly to the laptop's built-in webcam. However, the system architecture is structured with standard RTSP/HTTP protocols, allowing it to easily connect to any local CCTV or IP camera.
            </p>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ marginTop: 'auto', background: '#F8FAFC', borderTop: '1px solid var(--border-glass)', padding: '3rem 5% 2rem 5%' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '2rem', marginBottom: '3rem' }}>
          <div>
            <div className="logo" style={{ marginBottom: '1rem' }}>
              <Car size={24} className="text-primary" />
              <span>Park<span style={{ color: 'var(--primary)' }}>0</span></span>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Next-generation smart roadside parking management platforms. Powered by computer vision.
            </p>
          </div>
          <div>
            <h4 style={{ marginBottom: '1rem' }}>Product</h4>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              <li style={{ cursor: 'pointer' }} onClick={() => navigate('/find-parking')}>Find Parking</li>
              <li style={{ cursor: 'pointer' }} onClick={() => setIsLogin(false)}>Join as Shop Owner</li>
              <li>AI Camera Tech</li>
            </ul>
          </div>
          <div>
            <h4 style={{ marginBottom: '1rem' }}>Contact</h4>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              <li>Email: parko123@gmail.com</li>
              <li>Phone: +91 9876543210</li>
              <li>Belagavi, India</li>
            </ul>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'between', alignItems: 'center', borderTop: '1px solid var(--border-glass)', paddingTop: '1.5rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          <span>© 2026 Park0. All rights reserved.</span>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <span>Privacy Policy</span>
            <span>Terms of Service</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;

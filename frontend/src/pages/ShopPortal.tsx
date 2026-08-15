import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../App';
import { LayoutDashboard, Wallet, Camera, Power, Plus, TrendingUp, IndianRupee, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface Shop {
  id: number;
  name: string;
  address: string;
  total_length: number;
  price_per_hour: number;
  is_enabled: boolean;
}

const ShopPortal: React.FC = () => {
  const { token } = useAuth();

  // Shop states
  const [shops, setShops] = useState<Shop[]>([]);
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  
  // Shop Registration Form
  const [showRegForm, setShowRegForm] = useState(false);
  const [shopName, setShopName] = useState('');
  const [shopAddress, setShopAddress] = useState('');
  const [shopLength, setShopLength] = useState(40);
  const [shopPrice, setShopPrice] = useState(30);

  // Dashboard Metrics state
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawSuccess, setWithdrawSuccess] = useState(false);
  const [withdrawError, setWithdrawError] = useState('');
  
  // Camera WebSocket state
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStats, setCameraStats] = useState<any>(null);
  const wsRef = useRef<WebSocket | null>(null);
  
  // Webcam & Error states
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string>('');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraActiveRef = useRef<boolean>(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isProcessingRef = useRef<boolean>(false);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const fetchShops = async () => {
    try {
      const res = await fetch('http://127.0.0.1:8000/api/owner/shops', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setShops(data);
      if (data.length > 0 && !selectedShop) {
        setSelectedShop(data[0]);
      }
    } catch {
      // Mock shop fallback for demo
      const mockOwnerShops: Shop[] = [{
        id: 1,
        name: "Starbucks Indiranagar Roadside Bay",
        address: "100 Feet Rd, Indiranagar, Bengaluru",
        total_length: 50,
        price_per_hour: 40,
        is_enabled: true
      }];
      setShops(mockOwnerShops);
      setSelectedShop(mockOwnerShops[0]);
    }
  };

  const fetchDashboard = async () => {
    try {
      const res = await fetch('http://127.0.0.1:8000/api/owner/dashboard', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setDashboardData(data);
    } catch {
      // Mock dashboard analytics for demo
      setDashboardData({
        today_earnings: 120.0,
        monthly_earnings: 1480.0,
        active_bookings: 2,
        occupancy_percent: 65,
        total_length: selectedShop ? selectedShop.total_length : 50,
        occupied_length: 32.5,
        remaining_length: 17.5,
        wallet_balance: 750.0,
        recent_transactions: [
          { id: 101, amount: 80, type: 'earnings', status: 'completed', created_at: new Date().toISOString() },
          { id: 102, amount: 40, type: 'earnings', status: 'completed', created_at: new Date(Date.now() - 1000 * 3600).toISOString() },
          { id: 103, amount: -200, type: 'withdrawal', status: 'completed', created_at: new Date(Date.now() - 1000 * 3600 * 24).toISOString() }
        ],
        analytics: [
          { name: 'Mon', revenue: 150 },
          { name: 'Tue', revenue: 240 },
          { name: 'Wed', revenue: 180 },
          { name: 'Thu', revenue: 310 },
          { name: 'Fri', revenue: 280 },
          { name: 'Sat', revenue: 420 },
          { name: 'Sun', revenue: 380 }
        ]
      });
    }
  };

  useEffect(() => {
    if (token) {
      fetchShops();
      fetchDashboard();
    }
  }, [token]);

  useEffect(() => {
    if (selectedShop) {
      fetchDashboard();
    }
  }, [selectedShop]);

  const toggleParkingStatus = async () => {
    if (!selectedShop) return;
    try {
      const newStatus = !selectedShop.is_enabled;
      const res = await fetch(`http://127.0.0.1:8000/api/shops/${selectedShop.id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ is_enabled: newStatus })
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setSelectedShop(updated);
      setShops(shops.map(s => s.id === updated.id ? updated : s));
    } catch {
      // Mock toggle
      const updated = { ...selectedShop, is_enabled: !selectedShop.is_enabled };
      setSelectedShop(updated);
      setShops(shops.map(s => s.id === updated.id ? updated : s));
    }
  };

  const handleRegisterShop = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('http://127.0.0.1:8000/api/shops', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: shopName,
          address: shopAddress,
          latitude: 12.9716 + (Math.random() - 0.5) * 0.05,
          longitude: 77.5946 + (Math.random() - 0.5) * 0.05,
          total_length: shopLength,
          price_per_hour: shopPrice
        })
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setShops([...shops, data]);
      setSelectedShop(data);
      setShowRegForm(false);
    } catch {
      const mockNewShop = {
        id: Math.floor(Math.random() * 1000),
        name: shopName,
        address: shopAddress,
        total_length: shopLength,
        price_per_hour: shopPrice,
        is_enabled: true
      };
      setShops([...shops, mockNewShop]);
      setSelectedShop(mockNewShop);
      setShowRegForm(false);
    }
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    setWithdrawError('');
    setWithdrawSuccess(false);
    
    const amountNum = parseFloat(withdrawAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setWithdrawError('Enter a valid amount');
      return;
    }

    try {
      const res = await fetch('http://127.0.0.1:8000/api/owner/wallet/withdraw', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ amount: amountNum })
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || 'Withdrawal failed');
      }
      setWithdrawSuccess(true);
      setWithdrawAmount('');
      fetchDashboard();
    } catch (err: any) {
      if (dashboardData && dashboardData.wallet_balance >= amountNum) {
        // Mock fallback withdrawal success
        setDashboardData({
          ...dashboardData,
          wallet_balance: dashboardData.wallet_balance - amountNum,
          recent_transactions: [
            { id: Date.now(), amount: -amountNum, type: 'withdrawal', status: 'completed', created_at: new Date().toISOString() },
            ...dashboardData.recent_transactions
          ]
        });
        setWithdrawSuccess(true);
        setWithdrawAmount('');
      } else {
        setWithdrawError(err.message || 'Insufficient wallet balance');
      }
    }
  };

  const startCamera = async () => {
    if (!selectedShop) {
      setCameraError('Please register a shop first to activate the AI camera.');
      return;
    }
    setCameraError('');
    cameraActiveRef.current = true;
    
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('No webcam detected.');
        setCameraActive(false);
        cameraActiveRef.current = false;
        return;
      }
      
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = mediaStream;
      setStream(mediaStream);
      setCameraActive(true);

      // Connect to backend WebSocket
      const wsUrl = `ws://127.0.0.1:8000/api/ws/camera/${selectedShop.id}`;
      console.log(`[AI Detector] Connecting to WebSocket at ${wsUrl}...`);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log(`[AI Detector] WebSocket connected successfully to ${wsUrl}`);
        isProcessingRef.current = false;
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.error) {
            console.error("[AI Detector] Camera WebSocket error from backend:", data.error);
            setCameraError(data.error);
            stopCamera();
            return;
          }
          
          if (data.stats) {
            setCameraStats(data.stats);
            
            // Check if model loading failed
            if (data.stats.ai_status && data.stats.ai_status.includes("Load Error")) {
              setCameraError(`AI model error: ${data.stats.ai_status}`);
            } else {
              setCameraError('');
            }
            
            // Draw detections on the canvas overlay
            drawDetections(data.stats.vehicles);
          }
        } catch (e) {
          console.error("[AI Detector] Error parsing WebSocket message:", e);
        } finally {
          isProcessingRef.current = false;
          // Schedule next frame in 80ms (for ~12 FPS target, highly optimized)
          setTimeout(sendNextFrame, 80);
        }
      };

      ws.onerror = (err) => {
        console.error(`[AI Detector] Camera WebSocket connection error for URL: ${wsUrl}`, err);
        console.error("[AI Detector] Please check if: 1. The backend server is running on http://127.0.0.1:8000. 2. CORS or network settings allow connecting to it. 3. The shop ID exists in the database.");
        setCameraError(`Failed to connect to AI detector service (URL: ${wsUrl}). Please ensure the backend server is running on http://127.0.0.1:8000 and verify network connectivity.`);
        stopCamera();
      };

      ws.onclose = (event) => {
        console.log(`[AI Detector] WebSocket connection closed. Code: ${event.code}, Reason: ${event.reason || 'None'}`);
      };

    } catch (err: any) {
      console.error("Error accessing webcam:", err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('Camera permission denied.');
      } else {
        setCameraError('No webcam detected.');
      }
      setCameraActive(false);
      cameraActiveRef.current = false;
      setStream(null);
      streamRef.current = null;
    }
  };

  const stopCamera = () => {
    cameraActiveRef.current = false;
    isProcessingRef.current = false;
    
    // Close WebSocket
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    // Stop webcam tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    setStream(null);
    setCameraActive(false);
    setCameraStats(null);
    
    // Clear canvas
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  };

  const sendNextFrame = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    if (isProcessingRef.current) return;
    if (!videoRef.current || videoRef.current.paused || videoRef.current.ended) return;

    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      // Downscale to 640x480 for fast performance
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.6); // 0.6 quality for fast upload
        
        isProcessingRef.current = true;
        wsRef.current.send(JSON.stringify({ image: dataUrl }));
      }
    } catch (e) {
      console.error("Error capturing webcam frame:", e);
    }
  };

  const handleVideoPlay = () => {
    isProcessingRef.current = false;
    setTimeout(sendNextFrame, 100);
  };

  const drawDetections = (vehicles: any[]) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = video.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const scaleX = canvas.width / 640;
    const scaleY = canvas.height / 480;

    vehicles.forEach((v) => {
      let color = '#B464FF'; // default purple
      if (v.type === 'Car') color = '#3B82F6'; // blue
      else if (v.type === 'Bike') color = '#10B981'; // green
      else if (v.type === 'Bus') color = '#EC4899'; // pink
      else if (v.type === 'Truck') color = '#F59E0B'; // amber

      const x = v.x * scaleX;
      const y = v.y * scaleY;
      const w = v.w * scaleX;
      const h = v.h * scaleY;

      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, w, h);

      const label = `${v.type} ${v.confidence}%`;
      ctx.font = 'bold 12px Inter, sans-serif';
      
      const textWidth = ctx.measureText(label).width;
      ctx.fillStyle = color;
      ctx.fillRect(x - 1, y - 18, textWidth + 10, 18);

      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(label, x + 4, y - 5);
    });
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <div style={{ padding: '2rem 5%', minHeight: 'calc(100vh - 73px)' }}>
      
      {/* HEADER SECTION */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2.2rem' }}>Shop Owner Portal</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Manage roadside parking, AI camera feeds and wallet earnings.</p>
        </div>

        <div style={{ display: 'flex', gap: '1rem' }}>
          {selectedShop && (
            <button 
              onClick={toggleParkingStatus} 
              className={selectedShop.is_enabled ? "btn-secondary" : "btn-primary"}
              style={{ borderColor: selectedShop.is_enabled ? 'var(--color-green)' : 'rgba(255,255,255,0.07)' }}
            >
              <Power size={18} style={{ color: selectedShop.is_enabled ? 'var(--color-green)' : 'white' }} />
              {selectedShop.is_enabled ? "Disable Parking Bay" : "Enable Parking Bay"}
            </button>
          )}

          <button onClick={() => setShowRegForm(true)} className="btn-primary">
            <Plus size={18} />
            Register Shop
          </button>
        </div>
      </div>

      {/* SHOP SELECTOR */}
      {shops.length > 1 && (
        <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Active Shop Frontage:</span>
          <select 
            className="glass-input" 
            style={{ maxWidth: '300px', background: 'var(--bg-deep)' }}
            value={selectedShop?.id} 
            onChange={(e) => setSelectedShop(shops.find(s => s.id === parseInt(e.target.value)) || null)}
          >
            {shops.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* MAIN METRIC CARDS */}
      {dashboardData && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
          
          <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ padding: '0.8rem', background: 'var(--primary-glow)', borderRadius: '12px', color: 'var(--primary)' }}>
              <TrendingUp size={24} />
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>TODAY'S REVENUE</div>
              <strong style={{ fontSize: '1.4rem', display: 'flex', alignItems: 'center', color: 'var(--text-primary)' }}>
                <IndianRupee size={16} />{dashboardData.today_earnings}
              </strong>
            </div>
          </div>

          <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ padding: '0.8rem', background: 'var(--secondary-glow)', borderRadius: '12px', color: 'var(--secondary)' }}>
              <LayoutDashboard size={24} />
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>ACTIVE BOOKINGS</div>
              <strong style={{ fontSize: '1.4rem', color: 'var(--text-primary)' }}>{dashboardData.active_bookings}</strong>
            </div>
          </div>

          <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ padding: '0.8rem', background: 'var(--color-green-glow)', borderRadius: '12px', color: 'var(--color-green)' }}>
              <Camera size={24} />
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>ROAD OCCUPANCY</div>
              <strong style={{ fontSize: '1.4rem', color: 'var(--text-primary)' }}>{dashboardData.occupancy_percent}%</strong>
            </div>
          </div>

          <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ padding: '0.8rem', background: 'var(--color-yellow-glow)', borderRadius: '12px', color: 'var(--color-yellow)' }}>
              <Wallet size={24} />
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>WALLET BALANCE</div>
              <strong style={{ fontSize: '1.4rem', display: 'flex', alignItems: 'center', color: 'var(--text-primary)' }}>
                <IndianRupee size={16} />{dashboardData.wallet_balance}
              </strong>
            </div>
          </div>

        </div>
      )}

      {/* CONTENT GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '2rem' }}>
        
        {/* LEFT COLUMN: LIVE AI CAMERA VIDEO FEED */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div className="glass-card" style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Camera className="text-primary" />
                <h3 style={{ fontSize: '1.25rem' }}>Live AI Camera Feed (Webcam Prototype)</h3>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {cameraActive && (
                  <span className="badge badge-green">
                    <span className="glow-dot" style={{ color: 'var(--color-green)' }}></span>
                    STREAMING
                  </span>
                )}
                <button 
                  onClick={cameraActive ? stopCamera : startCamera} 
                  disabled={!selectedShop}
                  className={cameraActive ? "btn-secondary" : "btn-primary"}
                  style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', opacity: !selectedShop ? 0.5 : 1, cursor: !selectedShop ? 'not-allowed' : 'pointer' }}
                >
                  {cameraActive ? "Turn Off Camera" : "Turn On Camera"}
                </button>
              </div>
            </div>

            {/* Video Canvas screen */}
            <div style={{ 
              background: '#F1F5F9', 
              aspectRatio: '1.333', 
              borderRadius: '12px', 
              overflow: 'hidden', 
              position: 'relative',
              border: '1px solid var(--border-glass)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {cameraError ? (
                <div style={{ textAlign: 'center', color: 'var(--color-red)', padding: '2rem' }}>
                  <Camera size={48} style={{ margin: '0 auto 1rem auto', opacity: 0.5, color: 'var(--color-red)' }} />
                  <p>{cameraError}</p>
                  <button onClick={startCamera} className="btn-primary" style={{ marginTop: '1rem', padding: '0.5rem 1rem', fontSize: '0.85rem' }} disabled={!selectedShop}>
                    Try Again
                  </button>
                </div>
              ) : !selectedShop ? (
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
                  <Camera size={48} style={{ margin: '0 auto 1rem auto', opacity: 0.5 }} />
                  <p>Please register a shop to activate the AI Camera.</p>
                  <button onClick={() => setShowRegForm(true)} className="btn-primary" style={{ marginTop: '1rem', padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
                    Register Shop
                  </button>
                </div>
              ) : cameraActive && stream ? (
                <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    muted 
                    onPlay={handleVideoPlay}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                  />
                  <canvas 
                    ref={canvasRef} 
                    style={{ 
                      position: 'absolute', 
                      top: 0, 
                      left: 0, 
                      width: '100%', 
                      height: '100%', 
                      pointerEvents: 'none' 
                    }} 
                  />
                </div>
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
                  <Camera size={48} style={{ margin: '0 auto 1rem auto', opacity: 0.5 }} />
                  <p>AI Camera feed is currently idle.</p>
                  <button onClick={startCamera} className="btn-primary" style={{ marginTop: '1rem', padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
                    Engage AI Webcam
                  </button>
                </div>
              )}
            </div>

            {/* Camera Metrics Overlay */}
            {cameraActive && cameraStats && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginTop: '1.5rem', borderTop: '1px solid var(--border-glass)', paddingTop: '1.5rem', textAlign: 'center', fontSize: '0.85rem' }}>
                  <div>
                    <div style={{ color: 'var(--text-secondary)' }}>Total Road Width</div>
                    <strong style={{ fontSize: '1.1rem' }}>{cameraStats.total_length}m</strong>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-secondary)' }}>Occupied Space</div>
                    <strong style={{ fontSize: '1.1rem', color: 'var(--color-yellow)' }}>{cameraStats.occupied_length}m</strong>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-secondary)' }}>Free Space</div>
                    <strong style={{ fontSize: '1.1rem', color: 'var(--color-green)' }}>{cameraStats.remaining_length}m</strong>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-secondary)' }}>Detections</div>
                    <strong style={{ fontSize: '1.1rem' }}>{cameraStats.vehicle_count} vehicles</strong>
                  </div>
                </div>

                {/* Live Vehicle Type Counts */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginTop: '1rem', borderTop: '1px dashed var(--border-glass)', paddingTop: '1rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  <div>
                    <div>Cars Detected</div>
                    <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>{cameraStats.vehicles.filter((v: any) => v.type === 'Car').length}</strong>
                  </div>
                  <div>
                    <div>Bikes Detected</div>
                    <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>{cameraStats.vehicles.filter((v: any) => v.type === 'Bike').length}</strong>
                  </div>
                  <div>
                    <div>Buses Detected</div>
                    <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>{cameraStats.vehicles.filter((v: any) => v.type === 'Bus').length}</strong>
                  </div>
                  <div>
                    <div>Trucks Detected</div>
                    <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>{cameraStats.vehicles.filter((v: any) => v.type === 'Truck').length}</strong>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* DETECTED VEHICLES DETAIL LOG */}
          {cameraActive && cameraStats && cameraStats.vehicles.length > 0 && (
            <div className="glass-card">
              <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>AI Vehicle Log (Real-time)</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {cameraStats.vehicles.map((v: any, idx: number) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 1rem', background: '#F8FAFC', border: '1px solid var(--border-glass)', borderRadius: '8px', fontSize: '0.85rem' }}>
                    <span style={{ fontWeight: 600 }}>{v.type}</span>
                    <span style={{ color: 'var(--text-secondary)' }}>Physical length mapping: {v.length}m</span>
                    <span style={{ color: 'var(--primary)' }}>Confidence: {v.confidence}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: WALLET CASH-OUT & CHART */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* ANALYTICS GRAPH */}
          {dashboardData && (
            <div className="glass-card" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Revenue Analytics (Last 7 Days)</h3>
              <div style={{ height: '180px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dashboardData.analytics}>
                    <defs>
                      <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={10} tickLine={false} />
                    <YAxis stroke="var(--text-muted)" fontSize={10} tickLine={false} />
                    <Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid var(--border-glass)', borderRadius: '8px', color: 'var(--text-primary)' }} />
                    <Area type="monotone" dataKey="revenue" stroke="var(--primary)" fillOpacity={1} fill="url(#colorRev)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* WALLET WITHDRAWAL BOX */}
          {dashboardData && (
            <div className="glass-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <Wallet className="text-primary" />
                <h3 style={{ fontSize: '1.15rem' }}>Withdraw Earnings</h3>
              </div>

              {withdrawSuccess && (
                <div style={{ color: 'var(--color-green)', background: 'var(--color-green-glow)', padding: '0.6rem', borderRadius: '4px', fontSize: '0.85rem', marginBottom: '1rem', textAlign: 'center' }}>
                  Withdrawal processed successfully in sandbox mode!
                </div>
              )}

              {withdrawError && (
                <div style={{ color: 'var(--color-red)', background: 'var(--color-red-glow)', padding: '0.6rem', borderRadius: '4px', fontSize: '0.85rem', marginBottom: '1rem', textAlign: 'center' }}>
                  {withdrawError}
                </div>
              )}

              <form onSubmit={handleWithdraw} style={{ display: 'flex', gap: '0.8rem' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <span style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>₹</span>
                  <input 
                    type="number" 
                    placeholder="Enter amount to withdraw..." 
                    className="glass-input"
                    style={{ paddingLeft: '1.8rem' }}
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                  />
                </div>
                <button type="submit" className="btn-primary" style={{ padding: '0.6rem 1.2rem' }}>
                  Withdraw
                </button>
              </form>
            </div>
          )}

          {/* TRANSACTION HISTORY */}
          {dashboardData && (
            <div className="glass-card">
              <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Recent Wallet Transactions</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                {dashboardData.recent_transactions.map((tx: any) => (
                  <div key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.8rem', borderBottom: '1px solid var(--border-glass)' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem', fontWeight: 600 }}>
                        {tx.type === 'earnings' ? (
                          <ArrowDownLeft size={16} style={{ color: 'var(--color-green)' }} />
                        ) : (
                          <ArrowUpRight size={16} style={{ color: 'var(--color-yellow)' }} />
                        )}
                        {tx.type === 'earnings' ? 'Parking Booking Revenue' : 'Bank Account Withdrawal'}
                      </div>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        {new Date(tx.created_at).toLocaleDateString()} at {new Date(tx.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                    <strong style={{ fontSize: '1rem', color: tx.amount > 0 ? 'var(--color-green)' : 'var(--text-primary)' }}>
                      {tx.amount > 0 ? '+' : ''}₹{tx.amount}
                    </strong>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* REGISTRATION MODAL */}
      {showRegForm && (
        <div style={{
          position: 'fixed',
          top: 0, right: 0, bottom: 0, left: 0,
          background: 'rgba(15, 23, 42, 0.3)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50
        }}>
          <div className="glass-card animate-fade-in" style={{ maxWidth: '480px', width: '90%', padding: '2.5rem', background: '#FFFFFF', border: '1px solid var(--border-glass)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.4rem' }}>Register Shop Frontage</h3>
              <button onClick={() => setShowRegForm(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <Plus style={{ transform: 'rotate(45deg)' }} size={20} />
              </button>
            </div>

            <form onSubmit={handleRegisterShop} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', display: 'block' }}>Shop Name</label>
                <input 
                  type="text" 
                  required 
                  className="glass-input" 
                  placeholder="e.g. Starbucks Indiranagar" 
                  value={shopName} 
                  onChange={(e) => setShopName(e.target.value)} 
                />
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', display: 'block' }}>Shop Address</label>
                <input 
                  type="text" 
                  required 
                  className="glass-input" 
                  placeholder="Street Address, Area Name" 
                  value={shopAddress} 
                  onChange={(e) => setShopAddress(e.target.value)} 
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', display: 'block' }}>Total Roadside Length (m)</label>
                  <input 
                    type="number" 
                    required 
                    className="glass-input" 
                    value={shopLength} 
                    onChange={(e) => setShopLength(parseInt(e.target.value))} 
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', display: 'block' }}>Price per Hour (₹)</label>
                  <input 
                    type="number" 
                    required 
                    className="glass-input" 
                    value={shopPrice} 
                    onChange={(e) => setShopPrice(parseInt(e.target.value))} 
                  />
                </div>
              </div>

              <button type="submit" className="btn-primary" style={{ justifyContent: 'center', marginTop: '0.5rem' }}>
                Register Parking Location
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShopPortal;

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../App';
import { Search, MapPin, Navigation, IndianRupee, X, Check, ArrowRight } from 'lucide-react';
import { formatISTTime } from '../utils/dateUtils';

interface ShopParking {
  id: number;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  total_length: number;
  occupied_length: number;
  remaining_length: number;
  price_per_hour: number;
  status: 'Green' | 'Yellow' | 'Red';
  distance: number;
}

const FindParking: React.FC = () => {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const searchQ = searchParams.get('q') || '';

  // State variables
  const [search, setSearch] = useState(searchQ);
  const [shops, setShops] = useState<ShopParking[]>([]);
  const [selectedShop, setSelectedShop] = useState<ShopParking | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Booking Form State
  const [bookingModal, setBookingModal] = useState(false);
  const [vehicleType, setVehicleType] = useState('Car');
  const [vehicleLength, setVehicleLength] = useState(4.5);
  const [paymentMethod, setPaymentMethod] = useState('upi');
  
  const [isPaying, setIsPaying] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState<any>(null);
  const [bookingError, setBookingError] = useState<any>(null);

  const vehicleSpecs = [
    { type: 'Bike', length: 2.0, label: 'Motorcycle / Bike (2.0m)' },
    { type: 'Scooter', length: 2.0, label: 'Scooter (2.0m)' },
    { type: 'Auto Rickshaw', length: 3.0, label: 'Auto Rickshaw (3.0m)' },
    { type: 'Car', length: 4.5, label: 'Sedan / Hatchback (4.5m)' },
    { type: 'SUV', length: 5.0, label: 'SUV / Compact SUV (5.0m)' },
    { type: 'Van', length: 5.5, label: 'Van / Small Commercial (5.5m)' },
  ];

  const handleVehicleChange = (type: string) => {
    setVehicleType(type);
    const spec = vehicleSpecs.find(v => v.type === type);
    if (spec) setVehicleLength(spec.length);
  };

  const fetchShops = async () => {
    setLoading(true);
    try {

      const lat = 12.9716;
      const lng = 77.5946;
      const res = await fetch(`http://localhost:8000/api/shops/nearby?lat=${lat}&lng=${lng}`);
      if (!res.ok) throw new Error('API down');
      const data = await res.json();
      setShops(data);

      if (selectedShop) {
        const updated = data.find((s: ShopParking) => s.id === selectedShop.id);
        if (updated) setSelectedShop(updated);
      }
    } catch (err) {
      console.log("Using fallback mock shops data...");
      const mockShops: ShopParking[] = [
        {
          id: 1,
          name: "Starbucks Roadside Lane",
          address: "100 Feet Rd, Indiranagar, Bengaluru",
          latitude: 12.9716,
          longitude: 77.6412,
          total_length: 50,
          occupied_length: 32.5,
          remaining_length: 17.5,
          price_per_hour: 40,
          status: 'Yellow',
          distance: 1.2
        },
        {
          id: 2,
          name: "Corner House Ice Cream Parking",
          address: "80 Feet Rd, Indiranagar, Bengaluru",
          latitude: 12.9698,
          longitude: 77.6401,
          total_length: 30,
          occupied_length: 8.0,
          remaining_length: 22.0,
          price_per_hour: 30,
          status: 'Green',
          distance: 1.5
        },
        {
          id: 3,
          name: "Third Wave Coffee Zone",
          address: "12th Main Rd, HAL 2nd Stage, Indiranagar",
          latitude: 12.9745,
          longitude: 77.6425,
          total_length: 40,
          occupied_length: 38.5,
          remaining_length: 1.5,
          price_per_hour: 50,
          status: 'Red',
          distance: 1.8
        },
        {
          id: 4,
          name: "Lulu Supermarket Roadside",
          address: "Rajajinagar, Bengaluru",
          latitude: 12.9892,
          longitude: 77.5532,
          total_length: 60,
          occupied_length: 15.0,
          remaining_length: 45.0,
          price_per_hour: 30,
          status: 'Green',
          distance: 5.4
        }
      ];

      const filtered = mockShops.filter(s => 
        s.name.toLowerCase().includes(search.toLowerCase()) || 
        s.address.toLowerCase().includes(search.toLowerCase())
      );
      setShops(filtered);
      
      if (selectedShop) {
        const updated = filtered.find(s => s.id === selectedShop.id);
        if (updated) setSelectedShop(updated);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShops();

    const interval = setInterval(fetchShops, 5000);
    return () => clearInterval(interval);
  }, [search]);

  const handleBookSubmit = async () => {
    if (!user) {
      alert("Please sign in or create an account on the homepage to book parking!");
      return;
    }
    
    setIsPaying(true);
    setBookingError(null);

    await new Promise(resolve => setTimeout(resolve, 2000));

    try {
      const response = await fetch('http://localhost:8000/api/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          shop_id: selectedShop?.id,
          vehicle_type: vehicleType,
          vehicle_length: vehicleLength,
          payment_method: paymentMethod
        })
      });

      const data = await response.json();

      if (!response.ok) {

        throw new Error(JSON.stringify(data.detail) || "Booking failed");
      }

      setBookingSuccess(data);
      setBookingModal(false);
      fetchShops();
    } catch (err: any) {
      console.error(err);
      try {
        const parsed = JSON.parse(err.message);
        setBookingError(parsed);
      } catch {

        if (selectedShop && selectedShop.remaining_length >= vehicleLength) {
          const mockSuccess = {
            id: Math.floor(Math.random() * 10000),
            shop: selectedShop,
            vehicle_type: vehicleType,
            vehicle_length: vehicleLength,
            total_price: selectedShop.price_per_hour * 2,
            payment_id: `pay_mock_${Date.now()}`,
            start_time: new Date().toISOString()
          };
          setBookingSuccess(mockSuccess);
          setBookingModal(false);

          selectedShop.occupied_length += vehicleLength;
          selectedShop.remaining_length -= vehicleLength;
        } else {

          setBookingError({
            message: `Insufficient space! Needs ${vehicleLength}m, only ${selectedShop?.remaining_length}m available.`,
            suggestions: shops.filter(s => s.id !== selectedShop?.id && s.remaining_length >= vehicleLength)
          });
        }
      }
    } finally {
      setIsPaying(false);
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', height: 'calc(100vh - 73px)', position: 'relative' }}>
      
      {/* SIDEBAR SEARCH & LISTING */}
      <div style={{ 
        background: 'var(--bg-glass)', 
        borderRight: '1px solid var(--border-glass)', 
        padding: '1.5rem', 
        display: 'flex', 
        flexDirection: 'column',
        gap: '1rem',
        overflowY: 'auto'
      }}>
        
        <div>
          <h2 style={{ fontSize: '1.6rem', marginBottom: '0.5rem' }}>Find Roadside Parking</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>AI monitors occupied lengths in real time.</p>
        </div>

        <div style={{ position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
          <input 
            type="text" 
            placeholder="Search destination..." 
            className="glass-input"
            style={{ paddingLeft: '2.5rem' }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1 }}>
          {loading && shops.length === 0 ? (
            // Skeleton loaders
            Array(3).fill(0).map((_, i) => (
              <div key={i} className="skeleton" style={{ height: '110px', borderRadius: '16px' }}></div>
            ))
          ) : shops.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-secondary)' }}>
              No parking locations found matching your search.
            </div>
          ) : (
            shops.map((shop) => (
              <div 
                key={shop.id}
                onClick={() => setSelectedShop(shop)}
                className="glass-card"
                style={{ 
                  cursor: 'pointer',
                  border: selectedShop?.id === shop.id ? '2px solid var(--primary)' : '1px solid var(--border-glass)',
                  background: selectedShop?.id === shop.id ? 'rgba(37, 99, 235, 0.05)' : 'var(--bg-card)',
                  padding: '1.2rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 600 }}>{shop.name}</h4>
                  <span className={`badge badge-${shop.status === 'Green' ? 'green' : shop.status === 'Yellow' ? 'yellow' : 'red'}`}>
                    {shop.status === 'Green' ? 'Available' : shop.status === 'Yellow' ? 'Nearly Full' : 'Full'}
                  </span>
                </div>
                
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.2rem', marginBottom: '0.8rem' }}>
                  <MapPin size={12} /> {shop.address}
                </p>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', borderTop: '1px solid var(--border-glass)', paddingTop: '0.6rem' }}>
                  <div>
                    <span style={{ color: 'var(--text-secondary)' }}>Pricing:</span>
                    <strong style={{ marginLeft: '4px' }}>₹{shop.price_per_hour}/hr</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)' }}>Remaining:</span>
                    <strong style={{ marginLeft: '4px', color: shop.remaining_length > 5 ? 'var(--color-green)' : 'var(--color-yellow)' }}>{shop.remaining_length}m</strong>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* MAP VIEWPORT & MAP OVERLAYS */}
      <div style={{ position: 'relative', background: '#F1F5F9', overflow: 'hidden' }}>
        
        {/* Custom Glowing Vector Map Visualizer */}
        <div style={{ 
          width: '100%', 
          height: '100%', 
          position: 'absolute', 
          top: 0, 
          left: 0,
          background: 'radial-gradient(circle at center, #FFFFFF 0%, #E2E8F0 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {/* Glowing Map Grid Lines */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage: 'radial-gradient(rgba(37, 99, 235, 0.08) 1px, transparent 0)',
            backgroundSize: '30px 30px',
            opacity: 0.7
          }}></div>

          {/* Road Visualizers */}
          <svg style={{ position: 'absolute', width: '100%', height: '100%', pointerEvents: 'none' }}>
            {/* Major horizontal highway */}
            <path d="M 0 250 Q 500 220 1200 270" stroke="rgba(37, 99, 235, 0.08)" strokeWidth="60" fill="none" />
            <path d="M 0 250 Q 500 220 1200 270" stroke="rgba(37, 99, 235, 0.2)" strokeWidth="2" strokeDasharray="10, 10" fill="none" />
            
            {/* Indiranagar diagonal roads */}
            <path d="M 150 0 L 300 600" stroke="rgba(0, 0, 0, 0.03)" strokeWidth="40" fill="none" />
            <path d="M 700 0 L 850 600" stroke="rgba(0, 0, 0, 0.03)" strokeWidth="40" fill="none" />
          </svg>

          {/* Map Shop Pins */}
          {shops.map((shop) => {

            const left = shop.id === 1 ? '20%' : shop.id === 2 ? '45%' : shop.id === 3 ? '70%' : '80%';
            const top = shop.id === 1 ? '40%' : shop.id === 2 ? '25%' : shop.id === 3 ? '55%' : '75%';
            const pinColor = shop.status === 'Green' ? 'var(--color-green)' : shop.status === 'Yellow' ? 'var(--color-yellow)' : 'var(--color-red)';
            
            return (
              <div 
                key={shop.id}
                onClick={() => setSelectedShop(shop)}
                style={{
                  position: 'absolute',
                  left,
                  top,
                  transform: 'translate(-50%, -100%)',
                  cursor: 'pointer',
                  zIndex: selectedShop?.id === shop.id ? 10 : 2
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  
                  {/* Shop Floating Tag */}
                  <div className="glass-card" style={{ 
                    padding: '0.3rem 0.6rem', 
                    borderRadius: '8px', 
                    fontSize: '0.75rem', 
                    whiteSpace: 'nowrap',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                    border: selectedShop?.id === shop.id ? '1px solid var(--primary)' : '1px solid var(--border-glass)',
                    transform: 'translateY(-4px)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    background: '#FFFFFF'
                  }}>
                    <div className="glow-dot" style={{ color: pinColor }}></div>
                    <strong>{shop.name}</strong>
                    <span>₹{shop.price_per_hour}/hr</span>
                  </div>

                  {/* Marker Pin */}
                  <div style={{ 
                    width: '12px', 
                    height: '12px', 
                    borderRadius: '50%', 
                    background: pinColor,
                    boxShadow: `0 0 20px ${pinColor}`,
                    border: '2px solid white',
                    marginTop: '-2px'
                  }}></div>
                </div>
              </div>
            );
          })}
        </div>

        {/* DETAILS POPUP FOR SELECTED SHOP */}
        {selectedShop && (
          <div className="glass-card animate-fade-in" style={{
            position: 'absolute',
            bottom: '2rem',
            left: '2rem',
            right: '2rem',
            background: 'rgba(255, 255, 255, 0.95)',
            border: '1px solid rgba(37, 99, 235, 0.15)',
            padding: '1.8rem',
            maxWidth: '650px',
            zIndex: 20,
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.08)'
          }}>
            <button 
              onClick={() => setSelectedShop(null)}
              style={{ position: 'absolute', right: '1rem', top: '1rem', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
            >
              <X size={18} />
            </button>

            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '2rem' }}>
              <div>
                <span className={`badge badge-${selectedShop.status === 'Green' ? 'green' : selectedShop.status === 'Yellow' ? 'yellow' : 'red'}`} style={{ marginBottom: '0.8rem' }}>
                  {selectedShop.status === 'Green' ? 'Space Available' : selectedShop.status === 'Yellow' ? 'Nearly Full' : 'Fully Occupied'}
                </span>
                
                <h3 style={{ fontSize: '1.5rem', marginBottom: '0.3rem' }}>{selectedShop.name}</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}>{selectedShop.address}</p>

                {/* Progress bar visualizer */}
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>
                    <span>Occupied Length: {selectedShop.occupied_length}m</span>
                    <span>Total Frontage: {selectedShop.total_length}m</span>
                  </div>
                  <div style={{ height: '8px', background: '#E2E8F0', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ 
                      width: `${(selectedShop.occupied_length / selectedShop.total_length) * 100}%`, 
                      height: '100%', 
                      background: selectedShop.status === 'Green' ? 'var(--color-green)' : selectedShop.status === 'Yellow' ? 'var(--color-yellow)' : 'var(--color-red)'
                    }}></div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', borderLeft: '1px solid var(--border-glass)', paddingLeft: '1.5rem' }}>
                <div style={{ marginBottom: '1.2rem' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>HOURLY RATE</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 800, display: 'flex', alignItems: 'center' }}>
                    <IndianRupee size={22} /> {selectedShop.price_per_hour} <span style={{ fontSize: '0.9rem', fontWeight: 400, color: 'var(--text-secondary)' }}>/ hour</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button 
                    onClick={() => setBookingModal(true)} 
                    disabled={selectedShop.status === 'Red'}
                    className="btn-primary" 
                    style={{ flex: 1, justifyContent: 'center' }}
                  >
                    Book Now
                  </button>
                  <a 
                    href={`https://www.google.com/maps/dir/?api=1&destination=${selectedShop.latitude},${selectedShop.longitude}`}
                    target="_blank" 
                    rel="noreferrer" 
                    className="btn-secondary"
                    style={{ padding: '0.8rem' }}
                  >
                    <Navigation size={18} />
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* BOOKING MODAL */}
      {bookingModal && selectedShop && (
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
          <div className="glass-card animate-fade-in" style={{ maxWidth: '500px', width: '90%', padding: '2.5rem', background: '#FFFFFF', border: '1px solid var(--border-glass)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.4rem' }}>Confirm Parking Booking</h3>
              <button onClick={() => setBookingModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ marginBottom: '1.5rem', padding: '1rem', background: '#F8FAFC', borderRadius: '8px', border: '1px solid var(--border-glass)' }}>
              <strong>{selectedShop.name}</strong>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{selectedShop.address}</div>
              <div style={{ fontSize: '0.85rem', marginTop: '0.5rem', color: 'var(--color-green)' }}>
                Remaining Space: {selectedShop.remaining_length} meters
              </div>
            </div>

            {/* Vehicle Type Selection */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', display: 'block' }}>
                Select Vehicle Type
              </label>
              <select 
                className="glass-input" 
                value={vehicleType} 
                onChange={(e) => handleVehicleChange(e.target.value)}
                style={{ background: '#FFFFFF' }}
              >
                {vehicleSpecs.map(v => (
                  <option key={v.type} value={v.type}>{v.label}</option>
                ))}
              </select>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.4rem' }}>
                AI model will match physical width mapping in webcam logs.
              </div>
            </div>

            {/* Payment Method Selector */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', display: 'block' }}>
                Payment Method
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                <button 
                  onClick={() => setPaymentMethod('upi')}
                  className={paymentMethod === 'upi' ? 'btn-primary' : 'btn-secondary'}
                  style={{ justifyContent: 'center', padding: '0.6rem' }}
                >
                  UPI (GPay / PhonePe)
                </button>
                <button 
                  onClick={() => setPaymentMethod('razorpay')}
                  className={paymentMethod === 'razorpay' ? 'btn-primary' : 'btn-secondary'}
                  style={{ justifyContent: 'center', padding: '0.6rem' }}
                >
                  Razorpay Sandbox
                </button>
              </div>
            </div>

            {/* Summary details */}
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-glass)', paddingTop: '1rem', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              <div>
                <span style={{ color: 'var(--text-secondary)' }}>Minimum Duration:</span>
                <strong style={{ marginLeft: '4px' }}>2 Hours</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)' }}>Total Fee:</span>
                <strong style={{ marginLeft: '4px', color: 'var(--primary)' }}>₹{selectedShop.price_per_hour * 2}</strong>
              </div>
            </div>

            <button 
              onClick={handleBookSubmit} 
              disabled={isPaying} 
              className="btn-primary" 
              style={{ width: '100%', justifyContent: 'center' }}
            >
              {isPaying ? 'Processing Sandbox Payment...' : `Pay ₹${selectedShop.price_per_hour * 2} & Confirm`}
            </button>
          </div>
        </div>
      )}

      {/* ERROR MODAL (Insufficient Space & Suggestions) */}
      {bookingError && (
        <div style={{
          position: 'fixed',
          top: 0, right: 0, bottom: 0, left: 0,
          background: 'rgba(15, 23, 42, 0.3)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 60
        }}>
          <div className="glass-card animate-fade-in" style={{ maxWidth: '480px', width: '90%', padding: '2.5rem', background: '#FFFFFF', border: '1px solid var(--color-red)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.3rem', color: 'var(--color-red)' }}>Booking Rejected</h3>
              <button onClick={() => setBookingError(null)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            
            <p style={{ color: 'var(--text-primary)', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
              {bookingError.message || "Insufficient road frontage length to fit your vehicle at this location."}
            </p>

            {bookingError.suggestions && bookingError.suggestions.length > 0 && (
              <div>
                <h4 style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', marginBottom: '0.8rem' }}>SUGGESTED NEARBY PARKING:</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                  {bookingError.suggestions.map((s: any) => (
                    <div 
                      key={s.id} 
                      onClick={() => {
                        setSelectedShop(s);
                        setBookingError(null);
                        setBookingModal(true);
                      }}
                      className="glass-card" 
                      style={{ padding: '0.8rem 1rem', cursor: 'pointer', background: '#F8FAFC', border: '1px solid var(--border-glass)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{s.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Remaining: {s.remaining_length}m</div>
                      </div>
                      <button className="btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}>
                        Book <ArrowRight size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUCCESS MODAL */}
      {bookingSuccess && (
        <div style={{
          position: 'fixed',
          top: 0, right: 0, bottom: 0, left: 0,
          background: 'rgba(15, 23, 42, 0.3)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 60
        }}>
          <div className="glass-card animate-fade-in" style={{ maxWidth: '450px', width: '90%', padding: '2.5rem', background: '#FFFFFF', border: '1px solid var(--color-green)' }}>
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(16,185,129,0.2)', border: '2px solid var(--color-green)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem auto', color: 'var(--color-green)' }}>
                <Check size={28} />
              </div>
              <h3 style={{ fontSize: '1.5rem', color: 'var(--color-green)' }}>Booking Confirmed!</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Payment of ₹{bookingSuccess.total_price} successful</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', padding: '1rem', background: '#F8FAFC', borderRadius: '8px', border: '1px solid var(--border-glass)', fontSize: '0.85rem', marginBottom: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Location:</span>
                <strong>{bookingSuccess.shop?.name || selectedShop?.name}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Vehicle Type:</span>
                <strong>{bookingSuccess.vehicle_type} ({bookingSuccess.vehicle_length}m)</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Transaction ID:</span>
                <span style={{ fontFamily: 'monospace' }}>{bookingSuccess.payment_id}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Booking Start:</span>
                <span>{formatISTTime(bookingSuccess.start_time)}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button 
                onClick={() => {
                  setBookingSuccess(null);
                  navigate('/my-bookings');
                }} 
                className="btn-primary" 
                style={{ flex: 1, justifyContent: 'center' }}
              >
                Go to My Bookings
              </button>
              <button 
                onClick={() => setBookingSuccess(null)} 
                className="btn-secondary" 
                style={{ flex: 1, justifyContent: 'center' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FindParking;

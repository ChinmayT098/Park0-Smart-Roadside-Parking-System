import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { Clock, Navigation, XCircle, Calendar, RefreshCcw, MapPin } from 'lucide-react';

interface Booking {
  id: number;
  shop_id: number;
  vehicle_type: string;
  vehicle_length: number;
  start_time: string;
  end_time: string | null;
  status: 'active' | 'completed' | 'cancelled';
  total_price: number;
  payment_id: string;
  shop?: {
    name: string;
    address: string;
    latitude: number;
    longitude: number;
  };
}

const MyBookings: React.FC = () => {
  const { token } = useAuth();
  const [activeBookings, setActiveBookings] = useState<Booking[]>([]);
  const [historyBookings, setHistoryBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      // 1. Fetch active bookings
      const activeRes = await fetch('http://localhost:8000/api/bookings/active', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const activeData = await activeRes.json();
      
      // 2. Fetch history
      const historyRes = await fetch('http://localhost:8000/api/bookings/history', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const historyData = await historyRes.json();

      if (activeRes.ok) setActiveBookings(activeData);
      if (historyRes.ok) setHistoryBookings(historyData.filter((b: Booking) => b.status !== 'active'));
    } catch {
      // Standalone mockup data if backend is offline
      const mockActive: Booking[] = [
        {
          id: 5001,
          shop_id: 1,
          vehicle_type: "Car",
          vehicle_length: 4.5,
          start_time: new Date().toISOString(),
          end_time: null,
          status: 'active',
          total_price: 80,
          payment_id: "pay_mock_991823",
          shop: {
            name: "Starbucks Indiranagar Roadside Bay",
            address: "100 Feet Rd, Indiranagar, Bengaluru",
            latitude: 12.9716,
            longitude: 77.6412
          }
        }
      ];

      const mockHistory: Booking[] = [
        {
          id: 4982,
          shop_id: 2,
          vehicle_type: "Bike",
          vehicle_length: 2.0,
          start_time: new Date(Date.now() - 1000 * 3600 * 24).toISOString(),
          end_time: new Date(Date.now() - 1000 * 3600 * 22).toISOString(),
          status: 'completed',
          total_price: 60,
          payment_id: "pay_mock_881273",
          shop: {
            name: "Corner House Ice Cream Parking",
            address: "80 Feet Rd, Indiranagar, Bengaluru",
            latitude: 12.9698,
            longitude: 77.6401
          }
        }
      ];

      setActiveBookings(mockActive);
      setHistoryBookings(mockHistory);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchBookings();
    }
  }, [token]);

  const handleCancelBooking = async (bookingId: number) => {
    if (!window.confirm("Are you sure you want to cancel this booking? This will release the road length occupied by your vehicle.")) {
      return;
    }

    try {
      const res = await fetch(`http://localhost:8000/api/bookings/${bookingId}/cancel`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error();
      fetchBookings(); // Refresh list
    } catch {
      // Mock cancellation locally
      const cancelled = activeBookings.find(b => b.id === bookingId);
      if (cancelled) {
        cancelled.status = 'cancelled';
        cancelled.end_time = new Date().toISOString();
        setActiveBookings(activeBookings.filter(b => b.id !== bookingId));
        setHistoryBookings([cancelled, ...historyBookings]);
      }
    }
  };

  return (
    <div style={{ padding: '3rem 5%', minHeight: 'calc(100vh - 73px)' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
        <div>
          <h1 style={{ fontSize: '2.2rem' }}>My Parking Bookings</h1>
          <p style={{ color: 'var(--text-secondary)' }}>View active reservations, track routing and check booking histories.</p>
        </div>
        <button onClick={fetchBookings} className="btn-secondary" style={{ padding: '0.6rem 1.2rem' }}>
          <RefreshCcw size={16} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="skeleton" style={{ height: '140px', borderRadius: '16px' }}></div>
          <div className="skeleton" style={{ height: '80px', borderRadius: '16px' }}></div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
          
          {/* ACTIVE BOOKINGS SECTION */}
          <div>
            <h3 style={{ fontSize: '1.3rem', marginBottom: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Clock className="text-primary" /> Active Reservations
            </h3>

            {activeBookings.length === 0 ? (
              <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                You have no active parking bookings.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
                {activeBookings.map((booking) => (
                  <div key={booking.id} className="glass-card animate-fade-in" style={{ border: '1px solid rgba(37, 99, 235, 0.15)' }}>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                      <div>
                        <h4 style={{ fontSize: '1.2rem', marginBottom: '0.2rem' }}>{booking.shop?.name || "Roadside Space"}</h4>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                          <MapPin size={12} /> {booking.shop?.address}
                        </p>
                      </div>
                      <span className="badge badge-green">ACTIVE</span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', padding: '0.8rem', background: '#F8FAFC', borderRadius: '8px', border: '1px solid var(--border-glass)', fontSize: '0.8rem', marginBottom: '1.5rem' }}>
                      <div>
                        <span style={{ color: 'var(--text-secondary)' }}>Vehicle Size:</span>
                        <div style={{ fontWeight: 600 }}>{booking.vehicle_type} ({booking.vehicle_length}m)</div>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-secondary)' }}>Total Paid:</span>
                        <div style={{ fontWeight: 600, color: 'var(--primary)' }}>₹{booking.total_price}</div>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-secondary)' }}>Started At:</span>
                        <div style={{ fontWeight: 600 }}>{new Date(booking.start_time).toLocaleTimeString()}</div>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-secondary)' }}>Transaction ID:</span>
                        <div style={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>{booking.payment_id}</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '1rem' }}>
                      <a 
                        href={`https://www.google.com/maps/dir/?api=1&destination=${booking.shop?.latitude || 12.9716},${booking.shop?.longitude || 77.6412}`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-primary" 
                        style={{ flex: 1, justifyContent: 'center', fontSize: '0.85rem' }}
                      >
                        <Navigation size={14} /> Get Directions
                      </a>
                      <button 
                        onClick={() => handleCancelBooking(booking.id)}
                        className="btn-secondary" 
                        style={{ flex: 1, justifyContent: 'center', color: 'var(--color-red)', borderColor: 'rgba(239, 68, 68, 0.15)', fontSize: '0.85rem' }}
                      >
                        <XCircle size={14} /> Cancel Booking
                      </button>
                    </div>

                  </div>
                ))}
              </div>
            )}
          </div>

          {/* HISTORICAL BOOKINGS SECTION */}
          <div>
            <h3 style={{ fontSize: '1.3rem', marginBottom: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Calendar className="text-secondary" /> Booking History
            </h3>

            {historyBookings.length === 0 ? (
              <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                No past booking records.
              </div>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Location</th>
                      <th>Vehicle Size</th>
                      <th>Date</th>
                      <th>Total Cost</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyBookings.map((booking) => (
                      <tr key={booking.id}>
                        <td>
                          <strong style={{ display: 'block', color: 'var(--text-primary)' }}>{booking.shop?.name || "Roadside Space"}</strong>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{booking.shop?.address}</span>
                        </td>
                        <td>{booking.vehicle_type} ({booking.vehicle_length}m)</td>
                        <td>
                          {new Date(booking.start_time).toLocaleDateString()}
                          <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {new Date(booking.start_time).toLocaleTimeString()}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>₹{booking.total_price}</td>
                        <td>
                          <span className={`badge badge-${booking.status === 'completed' ? 'green' : 'red'}`} style={{ textTransform: 'uppercase' }}>
                            {booking.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
};

export default MyBookings;

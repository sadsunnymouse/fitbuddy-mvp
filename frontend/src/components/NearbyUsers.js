// frontend/src/components/NearbyUsers.js
import React, { useState, useEffect } from 'react';
import useGeolocation from '../hooks/useGeolocation';
import './NearbyUsers.css';

function NearbyUsers({ onSelectUser }) {
  const { location, loading: locLoading, error: locError } = useGeolocation();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (location) {
      setLoading(true);
      fetch(`/api/users/nearby?lat=${location.lat}&lon=${location.lon}&radius=5000`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      })
        .then(res => res.json())
        .then(data => {
          setUsers(data);
          setLoading(false);
        })
        .catch(err => {
          console.error(err);
          setLoading(false);
        });
    }
  }, [location]);

  if (locLoading) return <div className="nearby-container">Определение местоположения...</div>;
  if (locError) return <div className="nearby-container">Ошибка: {locError}</div>;
  if (!location) return <div className="nearby-container">Местоположение не определено</div>;
  if (loading) return <div className="nearby-container">Поиск людей рядом...</div>;

  return (
    <div className="nearby-container">
      <h2>Люди рядом (до 5 км)</h2>
      <div className="user-cards">
        {users.map(user => (
          <div key={user.id} className="user-card" onClick={() => onSelectUser(user.id)}>
            <div className="user-avatar">
              {user.avatar_url ? <img src={user.avatar_url} alt="" /> : <span>👤</span>}
            </div>
            <div className="user-info">
              <h3>{user.full_name}</h3>
              <p>{user.goal === 'lose_weight' ? 'Похудение' : user.goal === 'build_muscle' ? 'Набор массы' : 'Фитнес'}</p>
              {user.distance && <p className="distance">~ {(user.distance / 1000).toFixed(1)} км</p>}
              {user.location_address && <p className="address">📍 {user.location_address}</p>}
            </div>
          </div>
        ))}
        {users.length === 0 && <p>Никого не найдено поблизости</p>}
      </div>
    </div>
  );
}

export default NearbyUsers;
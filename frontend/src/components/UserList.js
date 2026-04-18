import React, { useState, useEffect } from 'react';
import { useNotification } from '../context/NotificationContext';
import './UserList.css';

function UserList({ onSelectUser }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [experienceLevel, setExperienceLevel] = useState('');
  const [goal, setGoal] = useState('');
  const [distance, setDistance] = useState('');
  const [locationStatus, setLocationStatus] = useState('unknown');
  const [userCoords, setUserCoords] = useState(null);
  const [manualLat, setManualLat] = useState('');
  const [manualLon, setManualLon] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const { showNotification } = useNotification();

  // Загружаем сохранённые координаты (без уведомления)
  useEffect(() => {
    const fetchSavedLocation = async () => {
      const token = localStorage.getItem('token');
      const userId = localStorage.getItem('userId');
      if (!token || !userId) return;
      try {
        const response = await fetch(`/api/users/${userId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (data.location_lat && data.location_lon) {
          setUserCoords({ lat: data.location_lat, lon: data.location_lon });
          setLocationStatus('granted');
        } else {
          setLocationStatus('unknown');
        }
      } catch (err) {
        console.error(err);
        setLocationStatus('unknown');
      }
    };
    fetchSavedLocation();
  }, []);

  const requestGeolocation = () => {
    if (!navigator.geolocation) {
      showNotification('Геолокация не поддерживается вашим браузером', 'error');
      setLocationStatus('denied');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setUserCoords({ lat: latitude, lon: longitude });
        setLocationStatus('granted');
        const token = localStorage.getItem('token');
        if (token) {
          try {
            await fetch('/api/user/location', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({ lat: latitude, lon: longitude })
            });
            showNotification('Местоположение сохранено!', 'success');
          } catch (err) {
            console.error(err);
          }
        }
        fetchUsersWithCoords(latitude, longitude);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          showNotification('Вы запретили доступ к геолокации. Укажите вручную.', 'warning');
          setLocationStatus('denied');
          setShowManualInput(true);
        } else {
          showNotification('Ошибка определения местоположения', 'error');
          setLocationStatus('denied');
        }
      }
    );
  };

  const saveManualLocation = () => {
    const lat = parseFloat(manualLat);
    const lon = parseFloat(manualLon);
    if (isNaN(lat) || isNaN(lon)) {
      showNotification('Введите корректные координаты', 'error');
      return;
    }
    setUserCoords({ lat, lon });
    setLocationStatus('manual');
    setShowManualInput(false);
    const token = localStorage.getItem('token');
    if (token) {
      fetch('/api/user/location', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ lat, lon })
      }).catch(err => console.error(err));
    }
    showNotification('Местоположение установлено вручную', 'success');
    fetchUsersWithCoords(lat, lon);
  };

  const fetchUsersWithCoords = async (lat, lon) => {
    setLoading(true);
    const token = localStorage.getItem('token');
    let radius = 5000;
    if (distance === '1km') radius = 1000;
    else if (distance === '2km') radius = 2000;
    else if (distance === '5km') radius = 5000;
    else if (distance === '7km') radius = 7000;
    else if (distance === 'above7km') radius = 500000;
    try {
      let url = `/api/users/nearby?lat=${lat}&lon=${lon}&radius=${radius}`;
      if (experienceLevel) url += `&experience_level=${experienceLevel}`;
      if (goal) url += `&goal=${goal}`;
      const response = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
      let data = await response.json();
      if (distance === 'above7km') data = data.filter(user => user.distance > 7000);
      setUsers(data);
    } catch (err) {
      console.error(err);
      showNotification('Ошибка загрузки пользователей', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsersWithoutLocation = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    let url = `/api/users?${experienceLevel ? `experience_level=${experienceLevel}&` : ''}${goal ? `goal=${goal}` : ''}`;
    try {
      const response = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await response.json();
      setUsers(data);
    } catch (err) {
      console.error(err);
      showNotification('Ошибка загрузки пользователей', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (locationStatus === 'granted' || locationStatus === 'manual') {
      if (userCoords && distance) {
        fetchUsersWithCoords(userCoords.lat, userCoords.lon);
      } else {
        fetchUsersWithoutLocation();
      }
    } else {
      fetchUsersWithoutLocation();
    }
  }, [experienceLevel, goal, distance, locationStatus, userCoords]);

  const renderLocationPanel = () => {
    if (locationStatus === 'granted' || locationStatus === 'manual') return null;
    return (
      <div className="location-panel">
        <p className="location-info">Чтобы находить людей рядом, разрешите доступ к геолокации или укажите местоположение вручную.</p>
        <div className="location-actions">
          <button className="location-allow-btn" onClick={requestGeolocation}>📍 Разрешить геолокацию</button>
          <button className="location-manual-btn" onClick={() => setShowManualInput(!showManualInput)}>✏️ Ввести вручную</button>
        </div>
        {showManualInput && (
          <div className="manual-input">
            <input type="number" step="any" placeholder="Широта" value={manualLat} onChange={(e) => setManualLat(e.target.value)} />
            <input type="number" step="any" placeholder="Долгота" value={manualLon} onChange={(e) => setManualLon(e.target.value)} />
            <button onClick={saveManualLocation}>Сохранить</button>
          </div>
        )}
      </div>
    );
  };

  if (loading) return <div className="user-list-container">Загрузка...</div>;

  return (
    <div className="user-list-container">
      <div className="filters">
        <select value={experienceLevel} onChange={(e) => setExperienceLevel(e.target.value)}>
          <option value="">Уровень подготовки (все)</option>
          <option value="beginner">Начинающий</option>
          <option value="amateur">Любитель</option>
          <option value="pro">Профессионал</option>
        </select>
        <select value={goal} onChange={(e) => setGoal(e.target.value)}>
          <option value="">Цель (все)</option>
          <option value="lose_weight">Похудение</option>
          <option value="build_muscle">Набор массы</option>
          <option value="stay_fit">Поддержание формы</option>
        </select>
        {(locationStatus === 'granted' || locationStatus === 'manual') && (
          <select value={distance} onChange={(e) => setDistance(e.target.value)}>
            <option value="">Расстояние (не важно)</option>
            <option value="1km">Меньше 1 км</option>
            <option value="2km">Меньше 2 км</option>
            <option value="5km">Меньше 5 км</option>
            <option value="7km">Меньше 7 км</option>
            <option value="above7km">Больше 7 км</option>
          </select>
        )}
      </div>
      {renderLocationPanel()}
      <h2>Люди рядом</h2>
      <div className="user-cards">
        {users.map(user => (
          <div key={user.id} className="user-card" onClick={() => onSelectUser(user.id)}>
            <div className="user-avatar">{user.avatar_url ? <img src={user.avatar_url} alt="" /> : <span>👤</span>}</div>
            <div className="user-info">
              <h3>{user.full_name}</h3>
              <p>{user.goal === 'lose_weight' ? 'Похудение' : user.goal === 'build_muscle' ? 'Набор массы' : 'Поддержание формы'}</p>
              {user.distance !== undefined && user.distance !== null && <p className="distance">~ {(user.distance / 1000).toFixed(1)} км</p>}
            </div>
          </div>
        ))}
        {users.length === 0 && <p className="no-users">Пользователи не найдены</p>}
      </div>
    </div>
  );
}

export default UserList;
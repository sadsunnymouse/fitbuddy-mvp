// frontend/src/components/MatchesList.js
import React, { useState, useEffect } from 'react';
import { useNotification } from '../context/NotificationContext';
import './MatchesList.css';

function MatchesList({ onSelectUser }) {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const { showNotification } = useNotification();

  const fetchMatches = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/matches/incoming', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Ошибка загрузки');
      const data = await response.json();
      setMatches(data);
    } catch (err) {
      console.error(err);
      showNotification(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatches();
  }, []);

  const handleAccept = async (matchId, fromUserId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/matches/accept/${matchId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Ошибка при принятии');
      showNotification('Мэтч принят! Теперь вы можете общаться в чате.', 'success');
      // Убираем принятый мэтч из списка
      setMatches(prev => prev.filter(m => m.id !== matchId));
      // Если нужно открыть чат – можно перейти на страницу чата, но пока просто обновляем
      if (onSelectUser) onSelectUser(fromUserId);
    } catch (err) {
      console.error(err);
      showNotification('Не удалось принять мэтч', 'error');
    }
  };

  if (loading) return <div className="matches-container">Загрузка...</div>;

  return (
    <div className="matches-container">
      <h2 className="matches-title">❤️ Вам поставили «Мэтч»</h2>
      {matches.length === 0 && <p className="no-matches">Пока нет новых мэтчей</p>}
      <div className="matches-list">
        {matches.map(match => (
          <div key={match.id} className="match-card" onClick={() => onSelectUser && onSelectUser(match.from_user_id)}>
            <div className="match-avatar">{match.avatar_url ? <img src={match.avatar_url} alt="" /> : <span>👤</span>}</div>
            <div className="match-info">
              <h3>{match.full_name}</h3>
              <p>{match.goal === 'lose_weight' ? 'Похудение' : match.goal === 'build_muscle' ? 'Набор массы' : 'Поддержание формы'}</p>
            </div>
            <button className="accept-btn" onClick={(e) => { e.stopPropagation(); handleAccept(match.id, match.from_user_id); }}>❤️ Принять</button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default MatchesList;
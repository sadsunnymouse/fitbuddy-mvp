// frontend/src/components/UserProfile.js
import React, { useState, useEffect } from 'react';
import EditProfile from './EditProfile';
import { useNotification } from '../context/NotificationContext';
import './UserProfile.css';

const API_URL = process.env.REACT_APP_API_URL || '';

function UserProfile({ userId, onBack, onOpenChat }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showEdit, setShowEdit] = useState(false);
  const [matchStatus, setMatchStatus] = useState(null);
  const [matchId, setMatchId] = useState(null);
  const [matchLoading, setMatchLoading] = useState(false);
  const { showNotification } = useNotification();

  const currentUserId = localStorage.getItem('userId');
  const token = localStorage.getItem('token');
  const isOwnProfile = user && user.id === currentUserId;

  const fetchUser = async () => {
    try {
      const response = await fetch(`${API_URL}/api/users/${userId}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (!response.ok) throw new Error('Не удалось загрузить профиль');
      const data = await response.json();
      setUser(data);
    } catch (err) {
      setError(err.message);
      showNotification(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const checkMatchStatus = async () => {
    if (!currentUserId || currentUserId === userId) return;
    try {
      const res = await fetch(`${API_URL}/api/matches/check/${userId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMatchStatus(data.status);
        if (data.status === 'accepted' && data.match_id) {
          setMatchId(data.match_id);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchUser();
    if (currentUserId && currentUserId !== userId) {
      checkMatchStatus();
    }
  }, [userId, token, currentUserId]);

  const handleMatch = async () => {
    setMatchLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/matches/request/${userId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        if (data.accepted) {
          setMatchStatus('accepted');
          const checkRes = await fetch(`${API_URL}/api/matches/check/${userId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const checkData = await checkRes.json();
          if (checkData.match_id) setMatchId(checkData.match_id);
          showNotification('Взаимный мэтч! Теперь вы можете общаться.', 'success');
        } else {
          setMatchStatus('pending');
          showNotification('Запрос на мэтч отправлен', 'success');
        }
      } else {
        showNotification(data.error || 'Ошибка', 'error');
      }
    } catch (err) {
      showNotification('Ошибка сети', 'error');
    } finally {
      setMatchLoading(false);
    }
  };

  const handleOpenChat = async () => {
    if (matchId && onOpenChat) {
      onOpenChat(matchId, userId, user?.full_name);
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/matches/check/${userId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.status === 'accepted' && data.match_id) {
        setMatchId(data.match_id);
        if (onOpenChat) onOpenChat(data.match_id, userId, user?.full_name);
      } else {
        showNotification('Чат недоступен', 'error');
      }
    } catch (err) {
      showNotification('Ошибка при открытии чата', 'error');
    }
  };

  const handleEdit = () => setShowEdit(true);
  const handleEditClose = () => setShowEdit(false);
  const handleProfileUpdate = (updated) => {
    setUser(prev => ({ ...prev, ...updated }));
    showNotification('Профиль обновлён', 'success');
  };

  if (loading) return <div className="profile-container">Загрузка...</div>;
  if (error) return <div className="profile-container">Ошибка: {error}</div>;
  if (!user) return <div className="profile-container">Пользователь не найден</div>;

  return (
    <div className="profile-container">
      <button className="back-btn" onClick={onBack}>← Назад</button>
      <div className="profile-card">
        <div className="avatar">
          {user.avatar_url ? <img src={user.avatar_url} alt="avatar" /> : <div className="avatar-placeholder">👤</div>}
        </div>
        <h2>{user.full_name}</h2>
        {isOwnProfile && <p className="email">{user.email}</p>}
        <div className="details">
          <p><strong>Пол:</strong> {user.gender === 'female' ? 'Женский' : 'Мужской'}</p>
          <p><strong>Цель:</strong> {
            user.goal === 'lose_weight' ? 'Похудение' :
            user.goal === 'build_muscle' ? 'Набор массы' : 'Поддержание формы'
          }</p>
          <p><strong>Уровень:</strong> {
            user.experience_level === 'beginner' ? 'Начинающий' :
            user.experience_level === 'amateur' ? 'Любитель' : 'Профессионал'
          }</p>
          {isOwnProfile && <p><strong>Показывать всех:</strong> {user.show_all_genders ? 'Да' : 'Нет'}</p>}
          {user.interests && user.interests.length > 0 && <p><strong>Интересы:</strong> {user.interests.join(', ')}</p>}
          {user.bio && <p><strong>О себе:</strong> {user.bio}</p>}
        </div>
        {!isOwnProfile && (
          <div className="action-buttons">
            {matchStatus === 'accepted' && (
              <button className="message-btn" onClick={handleOpenChat}>💬 Сообщение</button>
            )}
            {matchStatus === 'pending' && <button className="match-btn disabled" disabled>⏳ Запрос отправлен</button>}
            {matchStatus === 'received' && <button className="match-btn" onClick={handleMatch} disabled={matchLoading}>❤️ Ответить на мэтч</button>}
            {matchStatus === 'none' && <button className="match-btn" onClick={handleMatch} disabled={matchLoading}>❤️ Мэтч</button>}
          </div>
        )}
        {isOwnProfile && <button className="edit-btn" onClick={handleEdit}>✏️ Редактировать профиль</button>}
      </div>
      {showEdit && <EditProfile userId={userId} onClose={handleEditClose} onUpdate={handleProfileUpdate} />}
    </div>
  );
}

export default UserProfile;
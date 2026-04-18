// frontend/src/components/EventDetails.js
import React, { useState, useEffect } from 'react';
import { useNotification } from '../context/NotificationContext';
import './EventDetails.css';

const getColorFromName = (name) => {
  const palette = ['#d2ea4c', '#84aba4', '#979187', '#31374B', '#f3f7f1', '#4a9e8a', '#c4a35a', '#6c8b7a'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % palette.length;
  return palette[index];
};

function EventDetails({ eventId, onBack, onViewProfile, onOpenChat }) {
  const [event, setEvent] = useState(null);
  const [participants, setParticipants] = useState({ looking: [], booked: [] });
  const [mutualLooking, setMutualLooking] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userLooking, setUserLooking] = useState(false);
  const currentUserId = localStorage.getItem('userId');
  const token = localStorage.getItem('token');
  const { showNotification } = useNotification();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [eventRes, participantsRes, mutualRes] = await Promise.all([
          fetch(`/api/events/${eventId}`),
          fetch(`/api/events/${eventId}/participants`, {
            headers: { 'Authorization': `Bearer ${token}` }
          }),
          fetch(`/api/events/${eventId}/mutual-looking`, {
            headers: { 'Authorization': `Bearer ${token}` }
          })
        ]);
        if (!eventRes.ok) throw new Error('Событие не найдено');
        const eventData = await eventRes.json();
        const participantsData = await participantsRes.json();
        const mutualData = await mutualRes.json();
        setEvent(eventData);
        setParticipants(participantsData);
        setMutualLooking(mutualData);
        if (currentUserId) {
          const isLooking = participantsData.looking.some(p => p.user_id === currentUserId);
          setUserLooking(isLooking);
        }
      } catch (err) {
        console.error(err);
        showNotification(err.message, 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [eventId, currentUserId, token, showNotification]);

  const handleLookingToggle = async () => {
    if (!currentUserId) {
      showNotification('Необходимо войти', 'warning');
      return;
    }
    try {
      if (userLooking) {
        const res = await fetch(`/api/events/${eventId}/join`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          setUserLooking(false);
          setParticipants(prev => ({
            ...prev,
            looking: prev.looking.filter(p => p.user_id !== currentUserId)
          }));
          showNotification('Вы отменили запрос "Ищу компанию"', 'info');
        } else {
          const errData = await res.json();
          showNotification(errData.error || 'Ошибка при удалении запроса', 'error');
        }
      } else {
        const res = await fetch(`/api/events/${eventId}/join`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ status: 'looking', comment: 'Ищу компанию!' })
        });
        if (res.ok) {
          setUserLooking(true);
          const participantsRes = await fetch(`/api/events/${eventId}/participants`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const participantsData = await participantsRes.json();
          setParticipants(participantsData);
          showNotification('Вы добавили запрос "Ищу компанию"', 'success');
        } else {
          const errData = await res.json();
          showNotification(errData.error || 'Ошибка при добавлении запроса', 'error');
        }
      }
    } catch (err) {
      console.error(err);
      showNotification('Ошибка сети', 'error');
    }
  };

  const handleArrange = async (otherUserId) => {
    try {
      const response = await fetch(`/api/events/${eventId}/arrange/${otherUserId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Ошибка');
      }
      showNotification('Встреча подтверждена! Вы можете обсудить детали в чате.', 'success');
      const mutualRes = await fetch(`/api/events/${eventId}/mutual-looking`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const mutualData = await mutualRes.json();
      setMutualLooking(mutualData);
    } catch (err) {
      showNotification(err.message, 'error');
    }
  };

  const handleBook = () => {
    showNotification('Бронирование места (заглушка)', 'info');
  };

  const handleUserClick = (userId) => {
    if (onViewProfile) onViewProfile(userId);
  };

  const handleOpenChat = (matchId, userId, userName) => {
    if (onOpenChat) onOpenChat(matchId, userId, userName);
    else showNotification('Чат откроется здесь', 'info');
  };

  const matchedUsers = mutualLooking.filter(u => u.has_match === true);
  const nonMatchedUsers = mutualLooking.filter(u => u.has_match !== true);

  if (loading) return <div className="event-details-container">Загрузка...</div>;
  if (!event) return <div className="event-details-container">Событие не найдено</div>;

  return (
    <div className="event-details-container">
      <button className="back-btn" onClick={onBack}>← Назад</button>
      <div className="event-card-detail">
        <h2>{event.title}</h2>
        <p className="event-meta">{new Date(event.datetime_start).toLocaleString()} – {new Date(event.datetime_end).toLocaleTimeString()}</p>
        <p className="event-location-detail">📍 {event.venue || event.location}</p>
        <p className="event-organizer">👤 Организатор: {event.creator_type === 'user' ? 'Пользователь' : 'Заведение'}</p>
        <p className="event-description">{event.description}</p>
        <p className="event-slots-detail">Свободно мест: {event.available_slots} из {event.total_slots}</p>

        <div className="event-attendees">
          <h4>Кто идёт ({participants.booked.length})</h4>
          {participants.booked.map(p => <div key={p.user_id} className="attendee"><span>{p.full_name}</span></div>)}
          {participants.booked.length === 0 && <p>Пока никто не записался</p>}
        </div>

        {nonMatchedUsers.length > 0 && (
          <div className="event-looking">
            <h4>Ищут компанию ({nonMatchedUsers.length})</h4>
            <div className="looking-avatars">
              {nonMatchedUsers.map(user => {
                const initials = user.full_name ? user.full_name.charAt(0).toUpperCase() : '?';
                const bgColor = getColorFromName(user.full_name || user.user_id);
                return (
                  <div
                    key={user.user_id}
                    className="avatar-circle"
                    style={{ backgroundColor: bgColor }}
                    onClick={() => handleUserClick(user.user_id)}
                  >
                    <span className="avatar-initials">{initials}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {matchedUsers.length > 0 && (
          <div className="event-looking matched">
            <h4>❤️ Взаимный мэтч ({matchedUsers.length})</h4>
            <div className="looking-avatars">
              {matchedUsers.map(user => {
                const initials = user.full_name ? user.full_name.charAt(0).toUpperCase() : '?';
                const bgColor = getColorFromName(user.full_name || user.user_id);
                return (
                  <div key={user.user_id} className="avatar-with-actions">
                    <div
                      className="avatar-circle"
                      style={{ backgroundColor: bgColor }}
                      onClick={() => handleUserClick(user.user_id)}
                    >
                      <span className="avatar-initials">{initials}</span>
                    </div>
                    <div className="action-buttons-small">
                      {user.arrangement_status === 'confirmed' ? (
                        <button className="arranged-small" disabled>✓ Встреча</button>
                      ) : (
                        <button className="arrange-small" onClick={() => handleArrange(user.user_id)}>🤝 Договориться</button>
                      )}
                      <button className="chat-small" onClick={() => handleOpenChat(user.match_id, user.user_id, user.full_name)}>💬 Чат</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="event-actions">
          <button className="book-btn" onClick={handleBook}>Забронировать место</button>
          <button className={`looking-btn ${userLooking ? 'active' : ''}`} onClick={handleLookingToggle}>
            {userLooking ? 'Отменить запрос' : 'Ищу компанию'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default EventDetails;
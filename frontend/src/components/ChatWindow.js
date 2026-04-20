// frontend/src/components/ChatWindow.js
import React, { useState, useEffect } from 'react';
import { useNotification } from '../context/NotificationContext';
import './ChatWindow.css';

const API_URL = process.env.REACT_APP_API_URL || '';

function ChatWindow({ matchId, otherUserId, otherUserName, onBack }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [commonEvents, setCommonEvents] = useState([]);
  const token = localStorage.getItem('token');
  const { showNotification } = useNotification();

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const response = await fetch(`${API_URL}/api/messages/${matchId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Ошибка загрузки сообщений');
        const data = await response.json();
        setMessages(data);
      } catch (err) {
        console.error(err);
        showNotification(err.message, 'error');
      } finally {
        setLoading(false);
      }
    };
    const fetchCommonEvents = async () => {
      try {
        const response = await fetch(`${API_URL}/api/common-events/${otherUserId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Ошибка загрузки общих событий');
        const data = await response.json();
        setCommonEvents(data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchMessages();
    fetchCommonEvents();
  }, [matchId, otherUserId, token, showNotification]);

  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    try {
      const response = await fetch(`${API_URL}/api/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ match_id: matchId, text: newMessage })
      });
      if (!response.ok) throw new Error('Ошибка отправки');
      const sentMsg = await response.json();
      setMessages(prev => [...prev, sentMsg]);
      setNewMessage('');
    } catch (err) {
      console.error(err);
      showNotification('Не удалось отправить сообщение', 'error');
    }
  };

  const handleArrangeFromChat = async (eventId) => {
    try {
      const response = await fetch(`${API_URL}/api/events/${eventId}/arrange/${otherUserId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Не удалось договориться');
      showNotification('Встреча подтверждена!', 'success');
      const eventsRes = await fetch(`${API_URL}/api/common-events/${otherUserId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const eventsData = await eventsRes.json();
      setCommonEvents(eventsData);
    } catch (err) {
      showNotification(err.message, 'error');
    }
  };

  const currentUserId = localStorage.getItem('userId');

  if (loading) return <div className="chat-window-container">Загрузка...</div>;

  return (
    <div className="chat-window-container">
      <div className="chat-header">
        <button className="back-btn" onClick={onBack}>← Назад</button>
        <h3>{otherUserName}</h3>
      </div>

      {commonEvents.length > 0 && (
        <div className="common-events">
          <h4>📅 Общие события</h4>
          <div className="events-list">
            {commonEvents.map(ev => (
              <div key={ev.id} className="common-event-item">
                <div className="event-info">
                  <span className="event-title">{ev.title}</span>
                  <span className="event-date">{new Date(ev.datetime_start).toLocaleString()}</span>
                </div>
                {ev.arrangement_status === 'confirmed' ? (
                  <span className="confirmed-badge">✓ Встреча подтверждена</span>
                ) : (
                  <button className="arrange-from-chat" onClick={() => handleArrangeFromChat(ev.id)}>🤝 Договориться</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="messages-list">
        {messages.map(msg => (
          <div key={msg.id} className={`message ${msg.sender_id === currentUserId ? 'my-message' : 'their-message'}`}>
            <div className="message-bubble">{msg.text}</div>
          </div>
        ))}
      </div>
      <div className="message-input-area">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Введите сообщение..."
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
        />
        <button onClick={sendMessage}>Отправить</button>
      </div>
    </div>
  );
}

export default ChatWindow;
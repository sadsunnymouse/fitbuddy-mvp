// frontend/src/components/ChatList.js
import React, { useState, useEffect } from 'react';
import './ChatList.css';

function ChatList({ onSelectChat }) {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchChats = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/chats', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Ошибка загрузки чатов');
        const data = await response.json();
        setChats(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchChats();
  }, []);

  if (loading) return <div className="chats-container">Загрузка...</div>;

  return (
    <div className="chats-container">
      <h2>Чаты</h2>
      {chats.length === 0 && <p>У вас пока нет чатов. Начните общение с новым мэтчем!</p>}
      <div className="chats-list">
        {chats.map(chat => (
          <div key={chat.match_id} className="chat-item" onClick={() => onSelectChat(chat.match_id, chat.other_user_id, chat.full_name)}>
            <div className="chat-avatar">
              {chat.avatar_url ? <img src={chat.avatar_url} alt="" /> : <span>👤</span>}
            </div>
            <div className="chat-info">
              <h3>{chat.full_name}</h3>
              <p className="last-message">
                {chat.last_message ? chat.last_message : 'Отправьте сообщение первым!'}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ChatList;
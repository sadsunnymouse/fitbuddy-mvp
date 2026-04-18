import React, { useState, useEffect } from 'react';
import Onboarding from './components/Onboarding';
import Auth from './components/Auth';
import UserList from './components/UserList';
import EventList from './components/EventList';
import UserProfile from './components/UserProfile';
import EventDetails from './components/EventDetails';
import MatchesList from './components/MatchesList';
import ChatList from './components/ChatList';
import ChatWindow from './components/ChatWindow';
import { NotificationProvider, useNotification } from './context/NotificationContext';
import './App.css';

function AppContent() {
  const [screen, setScreen] = useState('onboarding');
  const [tab, setTab] = useState('people');
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [selectedChat, setSelectedChat] = useState(null);
  const [selectedChatUser, setSelectedChatUser] = useState('');
  const [authMode, setAuthMode] = useState('login');
  const { showNotification } = useNotification();

  const handleAuthSuccess = (userData) => {
    localStorage.setItem('userId', userData.id);
    setScreen('feed');
    checkUpcomingArrangements();
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('userId');
    setScreen('onboarding');
  };

  const handleMyProfile = () => {
    const myId = localStorage.getItem('userId');
    if (myId) { setSelectedUserId(myId); setScreen('profile'); }
  };

  const checkUpcomingArrangements = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const response = await fetch('/api/upcoming-arrangements', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) return;
      const data = await response.json();
      data.forEach(item => {
        showNotification(`🔔 Встреча с ${item.full_name} на "${item.event_title}" через ${item.hours_until} ч.`, 'info', 8000);
      });
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) { setScreen('feed'); checkUpcomingArrangements(); }
    const interval = setInterval(() => { if (localStorage.getItem('token')) checkUpcomingArrangements(); }, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const renderFeed = () => {
    switch (tab) {
      case 'people': return <UserList onSelectUser={(id) => { setSelectedUserId(id); setScreen('profile'); }} />;
      case 'matches': return <MatchesList onSelectUser={(id) => { setSelectedUserId(id); setScreen('profile'); }} />;
      case 'events': return <EventList onSelectEvent={(id) => { setSelectedEventId(id); setScreen('eventDetails'); }} />;
      case 'chats': return <ChatList onSelectChat={(matchId, userId, userName) => { setSelectedChat({ matchId, userId }); setSelectedChatUser(userName); setScreen('chatWindow'); }} />;
      default: return null;
    }
  };

  const renderScreen = () => {
    switch (screen) {
      case 'onboarding': return <Onboarding onSignUp={() => { setAuthMode('register'); setScreen('auth'); }} onLogin={() => { setAuthMode('login'); setScreen('auth'); }} />;
      case 'auth': return <Auth mode={authMode} onSuccess={handleAuthSuccess} />;
      case 'feed':
        return (
          <div>
            <div className="main-header">
              <div className="main-tabs">
                <button className={`tab-btn ${tab === 'people' ? 'active' : ''}`} onClick={() => setTab('people')}>Люди</button>
                <button className={`tab-btn ${tab === 'matches' ? 'active' : ''}`} onClick={() => setTab('matches')}>Мэтч</button>
                <button className={`tab-btn ${tab === 'chats' ? 'active' : ''}`} onClick={() => setTab('chats')}>Чаты</button>
                <button className={`tab-btn ${tab === 'events' ? 'active' : ''}`} onClick={() => setTab('events')}>События</button>
              </div>
              <button className="profile-icon-btn" onClick={handleMyProfile}>👤</button>
            </div>
            {renderFeed()}
            <button onClick={handleLogout} className="logout-btn">Выйти</button>
          </div>
        );
      case 'profile':
        return <UserProfile 
          userId={selectedUserId} 
          onBack={() => setScreen('feed')}
          onOpenChat={(matchId, userId, userName) => {
            setSelectedChat({ matchId, userId });
            setSelectedChatUser(userName);
            setScreen('chatWindow');
          }}
        />;
      case 'eventDetails':
        return <EventDetails eventId={selectedEventId} onBack={() => setScreen('feed')} onViewProfile={(userId) => { setSelectedUserId(userId); setScreen('profile'); }} onOpenChat={(matchId, userId, userName) => { setSelectedChat({ matchId, userId }); setSelectedChatUser(userName); setScreen('chatWindow'); }} />;
      case 'chatWindow':
        return <ChatWindow matchId={selectedChat.matchId} otherUserId={selectedChat.userId} otherUserName={selectedChatUser} onBack={() => setScreen('feed')} />;
      default: return null;
    }
  };
  return <>{renderScreen()}</>;
}

export default function App() {
  return (
    <NotificationProvider>
      <AppContent />
    </NotificationProvider>
  );
}
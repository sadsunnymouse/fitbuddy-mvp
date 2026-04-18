import React, { createContext, useState, useContext, useCallback } from 'react';

const NotificationContext = createContext();

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);

  const showNotification = useCallback((message, type = 'info', duration = 3000) => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, duration);
  }, []);

  const removeNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  return (
    <NotificationContext.Provider value={{ showNotification, removeNotification }}>
      {children}
      <div className="toast-container">
        {notifications.map(notif => (
          <div key={notif.id} className={`toast toast-${notif.type}`} onClick={() => removeNotification(notif.id)}>
            <span>{notif.message}</span>
            <button className="toast-close" onClick={(e) => { e.stopPropagation(); removeNotification(notif.id); }}>×</button>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
};
// frontend/src/components/EventList.js
import React, { useState, useEffect } from 'react';
import './EventList.css';

function EventList({ onSelectEvent }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const response = await fetch('/api/events');
        if (!response.ok) throw new Error('Ошибка загрузки');
        const data = await response.json();
        setEvents(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, []);

  if (loading) return <div className="event-list-container">Загрузка событий...</div>;

  return (
    <div className="event-list-container">
      <h2>События рядом</h2>
      <div className="event-cards">
        {events.map(event => (
          <div key={event.id} className="event-card" onClick={() => onSelectEvent(event.id)}>
            <h3>{event.title}</h3>
            <p className="event-datetime">
              {new Date(event.datetime_start).toLocaleString()}
            </p>
            <p className="event-location">📍 {event.venue || event.location}</p>
            <p className="event-slots">Свободно мест: {event.available_slots} / {event.total_slots}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default EventList;
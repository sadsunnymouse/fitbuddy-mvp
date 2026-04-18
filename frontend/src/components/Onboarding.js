// frontend/src/components/Onboarding.js
import React, { useState } from 'react';
import './Onboarding.css';

const slides = [
  {
    title: 'СПОРТ. И НИЧЕГО ЛИШНЕГО',
    description: (
      <ul>
        <li>Поиск только среди пользователей вашего пола</li>
        <li>Никаких романтических намёков в чатах</li>
        <li>Модерация и блокировка нарушителей</li>
        <li>Только совместные тренировки и общие цели</li>
      </ul>
    ),
  },
  {
    title: 'ПОИСК РЯДОМ С ДОМОМ',
    description: (
      <ul>
        <li>Поиск в радиусе 1–5 км от дома</li>
        <li>Удобные фильтры для поиска компаньонов с подходящей Вам спортивной подготовкой и целями</li>
        <li>Удобно встречаться для совместных тренировок</li>
      </ul>
    ),
  },
  {
    title: 'ОБЩАЙТЕСЬ В ЧАТЕ',
    description: (
      <ul>
        <li>Встроенный чат</li>
        <li>Кнопка "Договорились" для фиксации встречи</li>
      </ul>
    ),
  },
];

function Onboarding({ onSignUp, onLogin }) {
  const [currentSlide, setCurrentSlide] = useState(0);

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  };

  const handleSignUp = () => {
    if (onSignUp) onSignUp();
  };

  const handleLogin = () => {
    if (onLogin) onLogin();
  };

  const slide = slides[currentSlide];

  return (
    <div className="onboarding-container">
      <div className="header">
        <div className="dots">
          {slides.map((_, idx) => (
            <span
              key={idx}
              className={`dot ${idx === currentSlide ? 'active' : ''}`}
              onClick={() => setCurrentSlide(idx)}
            />
          ))}
        </div>
      </div>

      <div className="logo">🏋️ FitBuddy</div>

      <h2 className="title">{slide.title}</h2>
      <div className="description">{slide.description}</div>

      <div className="nav-buttons">
        <button className="nav-btn" onClick={prevSlide}>
          ◀ Назад
        </button>
        <button className="nav-btn" onClick={nextSlide}>
          Далее ▶
        </button>
      </div>

      <div className="auth-buttons">
        <button className="primary-btn" onClick={handleSignUp}>
          Создать аккаунт
        </button>
        <div className="login-row">
          <span className="login-text">Уже есть аккаунт?</span>
          <button className="link-btn" onClick={handleLogin}>
            Войти
          </button>
        </div>
      </div>
    </div>
  );
}

export default Onboarding;
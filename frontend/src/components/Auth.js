// frontend/src/components/Auth.js
import React, { useState } from 'react';
import { useNotification } from '../context/NotificationContext';
import './Auth.css';

const API_URL = process.env.REACT_APP_API_URL || '';

function Auth({ mode: initialMode = 'login', onSuccess }) {
  const [mode, setMode] = useState(initialMode);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    gender: '',
    goal: '',
    experience_level: ''
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState('');
  const { showNotification } = useNotification();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
    setServerError('');
  };

  const validateLogin = () => {
    const newErrors = {};
    if (!formData.email.trim()) newErrors.email = 'Email обязателен';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Некорректный email';
    if (!formData.password) newErrors.password = 'Пароль обязателен';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateRegister = () => {
    const newErrors = {};
    if (!formData.email.trim()) newErrors.email = 'Email обязателен';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Некорректный email';
    if (!formData.password) newErrors.password = 'Пароль обязателен';
    if (!formData.full_name.trim()) newErrors.full_name = 'Имя обязательно';
    if (!formData.gender) newErrors.gender = 'Выберите пол';
    if (!formData.goal) newErrors.goal = 'Выберите цель';
    if (!formData.experience_level) newErrors.experience_level = 'Выберите уровень';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const requestAndSaveLocation = async (token, userId) => {
    if (!navigator.geolocation) {
      showNotification('Геолокация не поддерживается браузером', 'warning');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          await fetch(`${API_URL}/api/user/location`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ lat: latitude, lon: longitude })
          });
          showNotification('Местоположение определено!', 'success');
        } catch (err) {
          console.error('Не удалось сохранить геолокацию', err);
          showNotification('Не удалось сохранить местоположение', 'error');
        }
      },
      (err) => {
        showNotification('Ошибка определения местоположения: ' + err.message, 'error');
      }
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const isValid = mode === 'login' ? validateLogin() : validateRegister();
    if (!isValid) return;

    setLoading(true);
    setServerError('');

    const endpoint = mode === 'login' ? `${API_URL}/api/auth/login` : `${API_URL}/api/auth/register`;
    const payload = mode === 'login'
      ? { email: formData.email, password: formData.password }
      : {
          email: formData.email,
          password: formData.password,
          full_name: formData.full_name,
          gender: formData.gender,
          goal: formData.goal,
          experience_level: formData.experience_level
        };

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Ошибка при выполнении запроса');
      }
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('userId', data.user.id);

      await requestAndSaveLocation(data.token, data.user.id);
      if (onSuccess) onSuccess(data.user);
    } catch (err) {
      setServerError(err.message);
      showNotification(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    setErrors({});
    setServerError('');
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="logo">🏋️ FitBuddy</div>
        <h2 className="auth-title">{mode === 'login' ? 'Вход' : 'Регистрация'}</h2>
        {serverError && <div className="server-error">{serverError}</div>}
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <input type="email" name="email" placeholder="Email" value={formData.email} onChange={handleChange} className={errors.email ? 'error' : ''} />
            {errors.email && <span className="error-text">{errors.email}</span>}
          </div>
          <div className="input-group">
            <input type="password" name="password" placeholder="Пароль" value={formData.password} onChange={handleChange} className={errors.password ? 'error' : ''} />
            {errors.password && <span className="error-text">{errors.password}</span>}
          </div>
          {mode === 'register' && (
            <>
              <div className="input-group">
                <input type="text" name="full_name" placeholder="Имя и фамилия" value={formData.full_name} onChange={handleChange} className={errors.full_name ? 'error' : ''} />
                {errors.full_name && <span className="error-text">{errors.full_name}</span>}
              </div>
              <div className="input-group">
                <select name="gender" value={formData.gender} onChange={handleChange} className={errors.gender ? 'error' : ''}>
                  <option value="">Пол</option>
                  <option value="female">Женский</option>
                  <option value="male">Мужской</option>
                </select>
                {errors.gender && <span className="error-text">{errors.gender}</span>}
              </div>
              <div className="input-group">
                <select name="goal" value={formData.goal} onChange={handleChange} className={errors.goal ? 'error' : ''}>
                  <option value="">Цель тренировок</option>
                  <option value="lose_weight">Похудение</option>
                  <option value="build_muscle">Набор массы</option>
                  <option value="stay_fit">Поддержание формы</option>
                </select>
                {errors.goal && <span className="error-text">{errors.goal}</span>}
              </div>
              <div className="input-group">
                <select name="experience_level" value={formData.experience_level} onChange={handleChange} className={errors.experience_level ? 'error' : ''}>
                  <option value="">Уровень подготовки</option>
                  <option value="beginner">Начинающий</option>
                  <option value="amateur">Любитель</option>
                  <option value="pro">Профессионал</option>
                </select>
                {errors.experience_level && <span className="error-text">{errors.experience_level}</span>}
              </div>
            </>
          )}
          <button type="submit" className="auth-btn" disabled={loading}>{loading ? 'Загрузка...' : (mode === 'login' ? 'Войти' : 'Зарегистрироваться')}</button>
        </form>
        <div className="auth-switch">
          <span>{mode === 'login' ? 'Нет аккаунта?' : 'Уже есть аккаунт?'}</span>
          <button className="link-btn" onClick={toggleMode}>{mode === 'login' ? 'Зарегистрироваться' : 'Войти'}</button>
        </div>
      </div>
    </div>
  );
}

export default Auth;
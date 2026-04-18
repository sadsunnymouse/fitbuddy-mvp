// frontend/src/components/EditProfile.js
import React, { useState, useEffect } from 'react';
import { useNotification } from '../context/NotificationContext';
import './EditProfile.css';

function EditProfile({ userId, onClose, onUpdate }) {
  const [formData, setFormData] = useState({
    full_name: '',
    gender: '',
    goal: '',
    experience_level: '',
    show_all_genders: false,
    bio: '',
    interests: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { showNotification } = useNotification();

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/users/${userId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Не удалось загрузить профиль');
        const data = await response.json();
        setFormData({
          full_name: data.full_name || '',
          gender: data.gender || '',
          goal: data.goal || '',
          experience_level: data.experience_level || '',
          show_all_genders: data.show_all_genders || false,
          bio: data.bio || '',
          interests: data.interests ? data.interests.join(', ') : ''
        });
      } catch (err) {
        setError(err.message);
        showNotification(err.message, 'error');
      }
    };
    fetchProfile();
  }, [userId, showNotification]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const payload = {
        ...formData,
        interests: formData.interests ? formData.interests.split(',').map(s => s.trim()) : []
      };
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Ошибка сохранения');
      }
      const updated = await response.json();
      if (onUpdate) onUpdate(updated);
      showNotification('Профиль успешно обновлён', 'success');
      onClose();
    } catch (err) {
      setError(err.message);
      showNotification(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="edit-profile-overlay">
      <div className="edit-profile-modal">
        <h2>Редактировать профиль</h2>
        {error && <div className="error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <label>Имя и фамилия</label>
          <input name="full_name" value={formData.full_name} onChange={handleChange} required />
          <label>Пол</label>
          <select name="gender" value={formData.gender} onChange={handleChange} required>
            <option value="">Выберите</option>
            <option value="female">Женский</option>
            <option value="male">Мужской</option>
          </select>
          <label>Цель тренировок</label>
          <select name="goal" value={formData.goal} onChange={handleChange} required>
            <option value="">Выберите</option>
            <option value="lose_weight">Похудение</option>
            <option value="build_muscle">Набор массы</option>
            <option value="stay_fit">Поддержание формы</option>
          </select>
          <label>Уровень подготовки</label>
          <select name="experience_level" value={formData.experience_level} onChange={handleChange} required>
            <option value="">Выберите</option>
            <option value="beginner">Начинающий</option>
            <option value="amateur">Любитель</option>
            <option value="pro">Профессионал</option>
          </select>
          <label className="checkbox-label">
            <input type="checkbox" name="show_all_genders" checked={formData.show_all_genders} onChange={handleChange} />
            Показывать всех пользователей (независимо от пола)
          </label>
          <label>О себе (био)</label>
          <textarea name="bio" value={formData.bio} onChange={handleChange} rows="3" />
          <label>Интересы (через запятую)</label>
          <input name="interests" value={formData.interests} onChange={handleChange} placeholder="йога, бег, скалодром" />
          <div className="modal-buttons">
            <button type="button" onClick={onClose}>Отмена</button>
            <button type="submit" disabled={loading}>{loading ? 'Сохранение...' : 'Сохранить'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditProfile;
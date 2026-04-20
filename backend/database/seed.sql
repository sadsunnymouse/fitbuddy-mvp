-- Очистка таблиц (данные удаляются, структура сохраняется)
TRUNCATE TABLE event_participants CASCADE;
TRUNCATE TABLE messages CASCADE;
TRUNCATE TABLE event_arrangements CASCADE;
TRUNCATE TABLE matches CASCADE;
TRUNCATE TABLE events CASCADE;
TRUNCATE TABLE profiles CASCADE;
TRUNCATE TABLE users CASCADE;

-- Фиксированный хеш для пароля 'test123'
DO $$
DECLARE
  password_hash TEXT := '$2b$10$WPWulqYb6j01LuKBrDKrZe9OKc0.iQlDiXGpRGgb2xx5MsbP1l.x6';
  
  -- Списки для генерации
  first_names_male TEXT[] := ARRAY['Александр', 'Дмитрий', 'Максим', 'Иван', 'Андрей', 'Сергей', 'Владимир', 'Алексей', 'Николай', 'Павел'];
  last_names_male TEXT[] := ARRAY['Иванов', 'Петров', 'Сидоров', 'Кузнецов', 'Смирнов', 'Васильев', 'Михайлов', 'Фёдоров', 'Соколов', 'Лебедев'];
  first_names_female TEXT[] := ARRAY['Анна', 'Елена', 'Мария', 'Ольга', 'Татьяна', 'Наталья', 'Ирина', 'Светлана', 'Юлия', 'Екатерина'];
  last_names_female TEXT[] := ARRAY['Иванова', 'Петрова', 'Сидорова', 'Кузнецова', 'Смирнова', 'Васильева', 'Михайлова', 'Фёдорова', 'Соколова', 'Лебедева'];
  
  goals TEXT[] := ARRAY['lose_weight', 'build_muscle', 'stay_fit'];
  levels TEXT[] := ARRAY['beginner', 'amateur', 'pro'];
  
  -- Переменные
  i INTEGER;
  email TEXT;
  full_name TEXT;
  gender TEXT;
  goal TEXT;
  level TEXT;
  show_all BOOLEAN;
  lat DOUBLE PRECISION;
  lon DOUBLE PRECISION;
  user_id UUID;
  event_id UUID;
  user_ids UUID[] := '{}';
BEGIN
  -- Генерация 50 пользователей
  FOR i IN 1..50 LOOP
    IF random() < 0.5 THEN
      gender := 'male';
      full_name := first_names_male[floor(random() * array_length(first_names_male, 1) + 1)] || ' ' || last_names_male[floor(random() * array_length(last_names_male, 1) + 1)];
    ELSE
      gender := 'female';
      full_name := first_names_female[floor(random() * array_length(first_names_female, 1) + 1)] || ' ' || last_names_female[floor(random() * array_length(last_names_female, 1) + 1)];
    END IF;
    
    email := lower(replace(full_name, ' ', '.')) || i || '@fitbuddy.com';
    goal := goals[floor(random() * array_length(goals, 1) + 1)];
    level := levels[floor(random() * array_length(levels, 1) + 1)];
    show_all := random() > 0.5;
    lat := 55.5 + random() * 0.4;
    lon := 37.3 + random() * 0.6;
    
    INSERT INTO users (id, email, password_hash) VALUES (gen_random_uuid(), email, password_hash) RETURNING id INTO user_id;
    INSERT INTO profiles (user_id, full_name, gender, goal, experience_level, show_all_genders, bio, interests, location_lat, location_lon)
    VALUES (user_id, full_name, gender, goal, level, show_all, 
            'Люблю активный отдых, ищу друзей по интересам',
            ARRAY['фитнес', 'бег', 'йога'],
            lat, lon);
    
    user_ids := user_ids || user_id;
  END LOOP;

  -- Генерация 10 событий
  DECLARE
    sport_types TEXT[] := ARRAY['yoga', 'running', 'fitness', 'crossfit', 'swimming', 'cycling', 'climbing', 'boxing', 'dance', 'pilates'];
    titles TEXT[] := ARRAY['Утренняя йога', 'Пробежка в парке', 'Кроссфит тренировка', 'Плавание в бассейне', 'Велосипедная прогулка', 'Скалолазание', 'Фитнес-марафон', 'Танцы', 'Пилатес', 'Бокс'];
    j INTEGER;
    creator_id UUID;
  BEGIN
    FOR j IN 1..10 LOOP
      creator_id := user_ids[floor(random() * array_length(user_ids, 1) + 1)];
      INSERT INTO events (id, title, description, sport_type, datetime_start, datetime_end, total_slots, available_slots, venue, location, creator_id, creator_type)
      VALUES (
        gen_random_uuid(),
        titles[j] || ' ' || j,
        'Описание события. Приходите!',
        sport_types[floor(random() * array_length(sport_types, 1) + 1)],
        NOW() + (random() * 30 * INTERVAL '1 day') + (random() * 10 * INTERVAL '1 hour'),
        NOW() + (random() * 30 * INTERVAL '1 day') + (random() * 10 * INTERVAL '1 hour') + INTERVAL '1 hour',
        floor(random() * 20 + 5)::INT,
        floor(random() * 15 + 1)::INT,
        CASE WHEN random() > 0.7 THEN 'Спортзал "Актив"' ELSE NULL END,
        'г. Москва, ул. ' || (floor(random() * 50) + 1)::TEXT,
        creator_id,
        'user'
      );
    END LOOP;
  END;

  -- Добавляем участия в событиях
  DECLARE
    event_rec RECORD;
    user_participations INTEGER;
  BEGIN
    FOR event_rec IN SELECT id FROM events LOOP
      user_participations := floor(random() * 20) + 1;
      FOR i IN 1..user_participations LOOP
        DECLARE
          participant_id UUID;
          status TEXT;
        BEGIN
          participant_id := user_ids[floor(random() * array_length(user_ids, 1) + 1)];
          status := CASE WHEN random() > 0.5 THEN 'looking' ELSE 'booked' END;
          BEGIN
            INSERT INTO event_participants (event_id, user_id, status, comment)
            VALUES (event_rec.id, participant_id, status, 'Комментарий участника');
          EXCEPTION WHEN unique_violation THEN
            -- Игнорируем дубликаты
          END;
        END;
      END LOOP;
    END LOOP;
  END;

  -- Добавляем взаимные мэтчи (10 случайных пар)
  DECLARE
    k INTEGER;
    user1 UUID;
    user2 UUID;
  BEGIN
    FOR k IN 1..10 LOOP
      LOOP
        user1 := user_ids[floor(random() * array_length(user_ids, 1) + 1)];
        user2 := user_ids[floor(random() * array_length(user_ids, 1) + 1)];
        EXIT WHEN user1 != user2 AND NOT EXISTS (SELECT 1 FROM matches WHERE (from_user_id = user1 AND to_user_id = user2) OR (from_user_id = user2 AND to_user_id = user1));
      END LOOP;
      INSERT INTO matches (from_user_id, to_user_id, status) VALUES (user1, user2, 'accepted');
    END LOOP;
  END;

  -- Добавляем договорённости на события
  DECLARE
    match_rec RECORD;
    common_event_id UUID;
  BEGIN
    FOR match_rec IN SELECT from_user_id, to_user_id FROM matches WHERE status = 'accepted' LOOP
      SELECT e.id INTO common_event_id
      FROM event_participants p1
      JOIN event_participants p2 ON p1.event_id = p2.event_id
      JOIN events e ON e.id = p1.event_id
      WHERE p1.user_id = match_rec.from_user_id AND p2.user_id = match_rec.to_user_id
        AND p1.status = 'looking' AND p2.status = 'looking'
      LIMIT 1;
      
      IF common_event_id IS NOT NULL THEN
        INSERT INTO event_arrangements (event_id, user1_id, user2_id, status)
        VALUES (common_event_id, match_rec.from_user_id, match_rec.to_user_id, 'confirmed')
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END;
END $$;
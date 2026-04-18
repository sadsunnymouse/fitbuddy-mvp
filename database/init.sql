-- Расширение для генерации UUID (уже должно быть включено в Postgres)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS cube;
CREATE EXTENSION IF NOT EXISTS earthdistance;

-- Таблица пользователей (аутентификация)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Таблица профилей (расширенная информация, связанная 1:1 с users)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    gender TEXT CHECK (gender IN ('female', 'male')),
    goal TEXT CHECK (goal IN ('lose_weight', 'build_muscle', 'stay_fit')),
    experience_level TEXT CHECK (experience_level IN ('beginner', 'amateur', 'pro')),
    interests TEXT[],        -- массив интересов (можно хранить как JSON)
    bio TEXT,
    avatar_url TEXT,
    location_lat DOUBLE PRECISION,
    location_lon DOUBLE PRECISION,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Индекс для быстрого поиска по email
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS show_all_genders BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_profiles_gender_show_all ON profiles(gender, show_all_genders);

-- Таблица событий (расширенная версия для MVP)
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    sport_type TEXT,
    datetime_start TIMESTAMP NOT NULL,
    datetime_end TIMESTAMP NOT NULL,
    total_slots INTEGER DEFAULT 0,
    available_slots INTEGER DEFAULT 0,
    venue TEXT,
    location TEXT,
    creator_id UUID REFERENCES users(id),
    creator_type TEXT CHECK (creator_type IN ('user', 'venue')),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Таблица участников событий (кто идёт / кто ищет компанию)
CREATE TABLE IF NOT EXISTS event_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('looking', 'booked', 'cancelled')),
    comment TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(event_id, user_id)
);

-- Добавим два тестовых события (чтобы было что показывать)
INSERT INTO events (id, title, description, sport_type, datetime_start, datetime_end, total_slots, available_slots, venue, location, creator_type, creator_id)
VALUES 
  (gen_random_uuid(), 'Сап-йога на рассвете', 'Пробная тренировка на озере. Доски предоставляются.', 'yoga', '2025-05-20 09:00:00', '2025-05-20 11:00:00', 5, 2, 'Студия "На волне"', 'ул. Набережная, 10', 'venue', (SELECT id FROM users LIMIT 1)),
  (gen_random_uuid(), 'Утренняя пробежка в парке', 'Лёгкий бег 5 км, темп 6:30/км.', 'running', '2025-05-21 08:00:00', '2025-05-21 09:00:00', 10, 7, NULL, 'Парк "Центральный"', 'user', (SELECT id FROM users LIMIT 1))
ON CONFLICT DO NOTHING;

-- Добавляем поля координат в таблицу profiles (если их ещё нет)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS location_lat DOUBLE PRECISION;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS location_lon DOUBLE PRECISION;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS location_address TEXT;

-- Индекс для ускорения поиска по earth_box
CREATE INDEX IF NOT EXISTS idx_profiles_location ON profiles USING gist (ll_to_earth(location_lat, location_lon));

-- Таблица мэтчей (запросы на знакомство)
CREATE TABLE IF NOT EXISTS matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    to_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(from_user_id, to_user_id)
);

-- Индекс для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_matches_to_user_id ON matches(to_user_id);
CREATE INDEX IF NOT EXISTS idx_matches_from_user_id ON matches(from_user_id);

-- Таблица сообщений чата
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_match_id ON messages(match_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);

-- Таблица договорённостей на события (встречи)
CREATE TABLE IF NOT EXISTS event_arrangements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user1_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user2_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(event_id, user1_id, user2_id)
);

CREATE INDEX IF NOT EXISTS idx_arrangements_event ON event_arrangements(event_id);
CREATE INDEX IF NOT EXISTS idx_arrangements_users ON event_arrangements(user1_id, user2_id);
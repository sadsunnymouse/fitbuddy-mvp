const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const port = 5000;
const JWT_SECRET = 'fitbuddy_super_secret_key_change_me';

app.use(cors());
app.use(express.json());

const pool = new Pool({
  host: process.env.DB_HOST || 'db',
  user: process.env.DB_USER || 'fitbuddy',
  password: process.env.DB_PASSWORD || 'fitbuddy123',
  database: process.env.DB_NAME || 'fitbuddy',
  port: process.env.DB_PORT || 5432,
});

// ---------- Middleware ----------
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Токен не предоставлен' });
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Неверный токен' });
    req.userId = user.userId;
    next();
  });
};

// ---------- Health check ----------
app.get('/api/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ status: 'ok', time: result.rows[0].now });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- Аутентификация ----------
app.post('/api/auth/register', async (req, res) => {
  const { email, password, full_name, gender, goal, experience_level } = req.body;
  if (!email || !password || !full_name || !gender || !goal || !experience_level) {
    return res.status(400).json({ error: 'Все поля обязательны' });
  }
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const userResult = await client.query(
        'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id',
        [email, hashedPassword]
      );
      const userId = userResult.rows[0].id;
      await client.query(
        `INSERT INTO profiles (user_id, full_name, gender, goal, experience_level, show_all_genders)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, full_name, gender, goal, experience_level, false]
      );
      await client.query('COMMIT');
      const token = jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: '7d' });
      res.status(201).json({ token, user: { id: userId, email, full_name } });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email уже существует' });
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email и пароль обязательны' });
  try {
    const userResult = await pool.query('SELECT id, email, password_hash FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) return res.status(401).json({ error: 'Неверный email или пароль' });
    const user = userResult.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Неверный email или пароль' });
    const profileResult = await pool.query('SELECT full_name FROM profiles WHERE user_id = $1', [user.id]);
    const full_name = profileResult.rows[0]?.full_name || '';
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, email, full_name } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ---------- Сохранение геолокации ----------
app.post('/api/user/location', authenticateToken, async (req, res) => {
  const userId = req.userId;
  const { lat, lon } = req.body;
  if (lat === undefined || lon === undefined) {
    return res.status(400).json({ error: 'Не указаны координаты' });
  }
  try {
    await pool.query(
      'UPDATE profiles SET location_lat = $1, location_lon = $2 WHERE user_id = $3',
      [lat, lon, userId]
    );
    res.json({ message: 'Координаты сохранены' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ---------- Пользователи и профили ----------
app.get('/api/users', authenticateToken, async (req, res) => {
  const currentUserId = req.userId;
  const { experience_level, goal } = req.query;
  try {
    const userSettings = await pool.query(
      'SELECT gender, show_all_genders FROM profiles WHERE user_id = $1',
      [currentUserId]
    );
    if (userSettings.rows.length === 0) return res.status(404).json({ error: 'Профиль не найден' });
    const { gender: myGender, show_all_genders: myShowAll } = userSettings.rows[0];

    let query = `
      SELECT u.id, u.email, p.full_name, p.gender, p.goal, p.experience_level, p.avatar_url, p.show_all_genders
      FROM users u
      JOIN profiles p ON u.id = p.user_id
      WHERE u.id != $1
    `;
    const params = [currentUserId];
    let paramIndex = 2;

    if (!myShowAll) {
      query += ` AND p.gender = $${paramIndex++}`;
      params.push(myGender);
    }
    if (experience_level) {
      query += ` AND p.experience_level = $${paramIndex++}`;
      params.push(experience_level);
    }
    if (goal) {
      query += ` AND p.goal = $${paramIndex++}`;
      params.push(goal);
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/api/users/nearby', authenticateToken, async (req, res) => {
  const currentUserId = req.userId;
  let { lat, lon, radius, experience_level, goal } = req.query;
  if (!lat || !lon) {
    return res.status(400).json({ error: 'Параметры lat и lon обязательны' });
  }
  radius = radius ? parseInt(radius) : 5000;
  try {
    const userSettings = await pool.query(
      'SELECT gender, show_all_genders FROM profiles WHERE user_id = $1',
      [currentUserId]
    );
    if (userSettings.rows.length === 0) return res.status(404).json({ error: 'Профиль не найден' });
    const { gender: myGender, show_all_genders: myShowAll } = userSettings.rows[0];

    let query = `
      SELECT u.id, u.email, p.full_name, p.gender, p.goal, p.experience_level, p.avatar_url,
             p.show_all_genders,
             earth_distance(
               ll_to_earth(p.location_lat, p.location_lon),
               ll_to_earth($1::float, $2::float)
             ) AS distance
      FROM users u
      JOIN profiles p ON u.id = p.user_id
      WHERE u.id != $3
        AND p.location_lat IS NOT NULL
        AND p.location_lon IS NOT NULL
        AND earth_box(ll_to_earth($1::float, $2::float), $4::float) @> ll_to_earth(p.location_lat, p.location_lon)
        AND earth_distance(
              ll_to_earth(p.location_lat, p.location_lon),
              ll_to_earth($1::float, $2::float)
            ) < $4::float
    `;
    const params = [lat, lon, currentUserId, radius];
    let paramIndex = 5;

    if (!myShowAll) {
      query += ` AND p.gender = $${paramIndex++}`;
      params.push(myGender);
    }
    if (experience_level) {
      query += ` AND p.experience_level = $${paramIndex++}`;
      params.push(experience_level);
    }
    if (goal) {
      query += ` AND p.goal = $${paramIndex++}`;
      params.push(goal);
    }
    query += ` ORDER BY distance ASC`;
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT u.id, u.email, p.full_name, p.gender, p.goal, p.experience_level, 
              p.interests, p.bio, p.avatar_url, p.location_lat, p.location_lon, p.show_all_genders
       FROM users u JOIN profiles p ON u.id = p.user_id WHERE u.id = $1`,
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Пользователь не найден' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.put('/api/profile', authenticateToken, async (req, res) => {
  const userId = req.userId;
  const { full_name, gender, goal, experience_level, interests, bio, avatar_url, show_all_genders } = req.body;
  try {
    const result = await pool.query(
      `UPDATE profiles 
       SET full_name = COALESCE($1, full_name),
           gender = COALESCE($2, gender),
           goal = COALESCE($3, goal),
           experience_level = COALESCE($4, experience_level),
           interests = COALESCE($5, interests),
           bio = COALESCE($6, bio),
           avatar_url = COALESCE($7, avatar_url),
           show_all_genders = COALESCE($8, show_all_genders),
           updated_at = NOW()
       WHERE user_id = $9
       RETURNING *`,
      [full_name, gender, goal, experience_level, interests, bio, avatar_url, show_all_genders, userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Профиль не найден' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ---------- События ----------
app.get('/api/events', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT e.*, 
             (SELECT COUNT(*) FROM event_participants WHERE event_id = e.id AND status = 'booked') as booked_count
      FROM events e
      ORDER BY e.datetime_start ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/api/events/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM events WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Событие не найдено' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/api/events/:id/participants', authenticateToken, async (req, res) => {
  const { id: eventId } = req.params;
  const currentUserId = req.userId;
  try {
    const userSettings = await pool.query(
      'SELECT gender, show_all_genders FROM profiles WHERE user_id = $1',
      [currentUserId]
    );
    if (userSettings.rows.length === 0) {
      return res.status(404).json({ error: 'Профиль не найден' });
    }
    const { gender: myGender, show_all_genders: myShowAll } = userSettings.rows[0];

    let query = `
      SELECT p.user_id, u.email, pr.full_name, p.status, p.comment, pr.gender
      FROM event_participants p
      JOIN users u ON p.user_id = u.id
      JOIN profiles pr ON u.id = pr.user_id
      WHERE p.event_id = $1
    `;
    const params = [eventId];
    if (!myShowAll) {
      query += ` AND pr.gender = $2`;
      params.push(myGender);
    }
    const result = await pool.query(query, params);
    const looking = result.rows.filter(r => r.status === 'looking');
    const booked = result.rows.filter(r => r.status === 'booked');
    res.json({ looking, booked });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.post('/api/events/:id/join', authenticateToken, async (req, res) => {
  const { id: eventId } = req.params;
  const userId = req.userId;
  const { status, comment } = req.body;
  if (!['looking', 'booked'].includes(status)) {
    return res.status(400).json({ error: 'Неверный статус' });
  }
  try {
    const eventCheck = await pool.query('SELECT id FROM events WHERE id = $1', [eventId]);
    if (eventCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Событие не найдено' });
    }
    await pool.query(
      `INSERT INTO event_participants (event_id, user_id, status, comment)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (event_id, user_id)
       DO UPDATE SET status = EXCLUDED.status, comment = EXCLUDED.comment`,
      [eventId, userId, status, comment || null]
    );
    res.status(200).json({ message: 'Статус обновлён' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.delete('/api/events/:id/join', authenticateToken, async (req, res) => {
  const { id: eventId } = req.params;
  const userId = req.userId;
  try {
    await pool.query(
      'DELETE FROM event_participants WHERE event_id = $1 AND user_id = $2',
      [eventId, userId]
    );
    res.status(200).json({ message: 'Участник удалён' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ---------- Мэтчи ----------
app.post('/api/matches/request/:userId', authenticateToken, async (req, res) => {
  const fromUserId = req.userId;
  const toUserId = req.params.userId;
  if (fromUserId === toUserId) {
    return res.status(400).json({ error: 'Нельзя отправить запрос самому себе' });
  }
  try {
    const existing = await pool.query(
      'SELECT * FROM matches WHERE (from_user_id = $1 AND to_user_id = $2) OR (from_user_id = $2 AND to_user_id = $1)',
      [fromUserId, toUserId]
    );
    if (existing.rows.length > 0) {
      const match = existing.rows[0];
      if (match.status === 'accepted') {
        return res.status(400).json({ error: 'Вы уже в мэтче с этим пользователем' });
      }
      if (match.from_user_id === fromUserId && match.status === 'pending') {
        return res.status(400).json({ error: 'Запрос уже отправлен' });
      }
      if (match.from_user_id === toUserId && match.status === 'pending') {
        // Ответный запрос: принимаем автоматически
        await pool.query(
          'UPDATE matches SET status = $1, updated_at = NOW() WHERE id = $2',
          ['accepted', match.id]
        );
        return res.json({ message: 'Взаимный мэтч!', accepted: true });
      }
    }
    await pool.query(
      'INSERT INTO matches (from_user_id, to_user_id, status) VALUES ($1, $2, $3)',
      [fromUserId, toUserId, 'pending']
    );
    res.json({ message: 'Запрос на мэтч отправлен', accepted: false });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.post('/api/matches/accept/:matchId', authenticateToken, async (req, res) => {
  const matchId = req.params.matchId;
  const userId = req.userId;
  try {
    const match = await pool.query(
      'SELECT * FROM matches WHERE id = $1 AND to_user_id = $2 AND status = $3',
      [matchId, userId, 'pending']
    );
    if (match.rows.length === 0) {
      return res.status(404).json({ error: 'Запрос не найден или уже обработан' });
    }
    await pool.query(
      'UPDATE matches SET status = $1, updated_at = NOW() WHERE id = $2',
      ['accepted', matchId]
    );
    res.json({ message: 'Мэтч принят' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/api/matches/incoming', authenticateToken, async (req, res) => {
  const userId = req.userId;
  try {
    const result = await pool.query(
      `SELECT m.id, m.from_user_id, u.email, p.full_name, p.avatar_url, p.goal, p.experience_level, m.status, m.created_at
       FROM matches m
       JOIN users u ON m.from_user_id = u.id
       JOIN profiles p ON u.id = p.user_id
       WHERE m.to_user_id = $1 AND m.status = 'pending'
       ORDER BY m.created_at DESC`,
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/api/matches/check/:userId', authenticateToken, async (req, res) => {
  const currentUserId = req.userId;
  const otherUserId = req.params.userId;
  try {
    const result = await pool.query(
      `SELECT id, status FROM matches 
       WHERE (from_user_id = $1 AND to_user_id = $2) OR (from_user_id = $2 AND to_user_id = $1)`,
      [currentUserId, otherUserId]
    );
    if (result.rows.length === 0) {
      return res.json({ status: 'none', match_id: null });
    }
    const match = result.rows[0];
    if (match.status === 'accepted') {
      return res.json({ status: 'accepted', match_id: match.id });
    }
    if (match.from_user_id === currentUserId && match.status === 'pending') {
      return res.json({ status: 'pending', match_id: null });
    }
    if (match.from_user_id === otherUserId && match.status === 'pending') {
      return res.json({ status: 'received', match_id: null });
    }
    res.json({ status: 'none', match_id: null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ---------- Договорённости на события и общие события ----------
app.get('/api/events/:id/mutual-looking', authenticateToken, async (req, res) => {
  const eventId = req.params.id;
  const currentUserId = req.userId;
  try {
    const result = await pool.query(
      `SELECT p.user_id, u.email, pr.full_name, pr.avatar_url, pr.gender, pr.goal, pr.experience_level
       FROM event_participants p
       JOIN users u ON p.user_id = u.id
       JOIN profiles pr ON u.id = pr.user_id
       WHERE p.event_id = $1 AND p.status = 'looking' AND p.user_id != $2`,
      [eventId, currentUserId]
    );
    const mutual = [];
    for (const row of result.rows) {
      const matchRes = await pool.query(
        `SELECT id, status FROM matches 
         WHERE (from_user_id = $1 AND to_user_id = $2) OR (from_user_id = $2 AND to_user_id = $1)`,
        [currentUserId, row.user_id]
      );
      let hasMatch = false;
      let matchId = null;
      if (matchRes.rows.length > 0) {
        const match = matchRes.rows[0];
        if (match.status === 'accepted') {
          hasMatch = true;
          matchId = match.id;
        }
      }
      const arrangeRes = await pool.query(
        `SELECT * FROM event_arrangements 
         WHERE event_id = $1 AND ((user1_id = $2 AND user2_id = $3) OR (user1_id = $3 AND user2_id = $2))`,
        [eventId, currentUserId, row.user_id]
      );
      const arrangementStatus = arrangeRes.rows[0]?.status || null;
      const arrangementId = arrangeRes.rows[0]?.id || null;
      mutual.push({
        ...row,
        has_match: hasMatch,
        match_id: matchId,
        arrangement_status: arrangementStatus,
        arrangement_id: arrangementId
      });
    }
    res.json(mutual);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.post('/api/events/:id/arrange/:userId', authenticateToken, async (req, res) => {
  const eventId = req.params.id;
  const user1Id = req.userId;
  const user2Id = req.params.userId;
  if (user1Id === user2Id) {
    return res.status(400).json({ error: 'Нельзя договориться с самим собой' });
  }
  try {
    const check = await pool.query(
      `SELECT user_id FROM event_participants 
       WHERE event_id = $1 AND user_id IN ($2, $3) AND status = 'looking'`,
      [eventId, user1Id, user2Id]
    );
    if (check.rows.length !== 2) {
      return res.status(400).json({ error: 'Оба пользователя должны отметить "Ищу компанию"' });
    }
    const result = await pool.query(
      `INSERT INTO event_arrangements (event_id, user1_id, user2_id, status, updated_at)
       VALUES ($1, $2, $3, 'confirmed', NOW())
       ON CONFLICT (event_id, user1_id, user2_id)
       DO UPDATE SET status = 'confirmed', updated_at = NOW()
       RETURNING *`,
      [eventId, user1Id, user2Id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/api/common-events/:userId', authenticateToken, async (req, res) => {
  const currentUserId = req.userId;
  const otherUserId = req.params.userId;
  try {
    const result = await pool.query(
      `SELECT DISTINCT e.*, 
              a.status as arrangement_status, a.id as arrangement_id
       FROM event_participants p1
       JOIN event_participants p2 ON p1.event_id = p2.event_id
       JOIN events e ON e.id = p1.event_id
       LEFT JOIN event_arrangements a ON a.event_id = e.id 
          AND ((a.user1_id = $1 AND a.user2_id = $2) OR (a.user1_id = $2 AND a.user2_id = $1))
       WHERE p1.user_id = $1 AND p2.user_id = $2 
         AND p1.status = 'looking' AND p2.status = 'looking'
       ORDER BY e.datetime_start ASC`,
      [currentUserId, otherUserId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/api/upcoming-arrangements', authenticateToken, async (req, res) => {
  const userId = req.userId;
  try {
    const result = await pool.query(
      `SELECT a.*, 
              e.title as event_title, 
              e.datetime_start,
              CASE WHEN a.user1_id = $1 THEN a.user2_id ELSE a.user1_id END as other_user_id,
              p.full_name
       FROM event_arrangements a
       JOIN events e ON a.event_id = e.id
       JOIN profiles p ON p.user_id = (CASE WHEN a.user1_id = $1 THEN a.user2_id ELSE a.user1_id END)
       WHERE (a.user1_id = $1 OR a.user2_id = $1) 
         AND a.status = 'confirmed'
         AND e.datetime_start > NOW()
         AND e.datetime_start <= NOW() + INTERVAL '2 hours'
       ORDER BY e.datetime_start ASC`,
      [userId]
    );
    const reminders = result.rows.map(row => ({
      full_name: row.full_name,
      event_title: row.event_title,
      hours_until: Math.ceil((new Date(row.datetime_start) - new Date()) / (1000 * 60 * 60))
    }));
    res.json(reminders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ---------- Чаты и сообщения ----------
app.get('/api/chats', authenticateToken, async (req, res) => {
  const userId = req.userId;
  try {
    const result = await pool.query(
      `SELECT 
          m.id as match_id,
          CASE WHEN m.from_user_id = $1 THEN m.to_user_id ELSE m.from_user_id END as other_user_id,
          u.email,
          p.full_name,
          p.avatar_url,
          (SELECT text FROM messages WHERE match_id = m.id ORDER BY created_at DESC LIMIT 1) as last_message,
          (SELECT created_at FROM messages WHERE match_id = m.id ORDER BY created_at DESC LIMIT 1) as last_message_time
       FROM matches m
       JOIN users u ON u.id = CASE WHEN m.from_user_id = $1 THEN m.to_user_id ELSE m.from_user_id END
       JOIN profiles p ON u.id = p.user_id
       WHERE (m.from_user_id = $1 OR m.to_user_id = $1) AND m.status = 'accepted'
       ORDER BY last_message_time DESC NULLS LAST`,
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/api/messages/:matchId', authenticateToken, async (req, res) => {
  const { matchId } = req.params;
  const userId = req.userId;
  try {
    const matchCheck = await pool.query(
      'SELECT * FROM matches WHERE id = $1 AND (from_user_id = $2 OR to_user_id = $2) AND status = $3',
      [matchId, userId, 'accepted']
    );
    if (matchCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Доступ запрещён' });
    }
    const result = await pool.query(
      'SELECT * FROM messages WHERE match_id = $1 ORDER BY created_at ASC',
      [matchId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.post('/api/messages', authenticateToken, async (req, res) => {
  const senderId = req.userId;
  const { match_id, text } = req.body;
  if (!match_id || !text) {
    return res.status(400).json({ error: 'Не указаны match_id или текст' });
  }
  try {
    const matchCheck = await pool.query(
      'SELECT * FROM matches WHERE id = $1 AND (from_user_id = $2 OR to_user_id = $2) AND status = $3',
      [match_id, senderId, 'accepted']
    );
    if (matchCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Доступ запрещён' });
    }
    const result = await pool.query(
      'INSERT INTO messages (match_id, sender_id, text) VALUES ($1, $2, $3) RETURNING *',
      [match_id, senderId, text]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Запуск сервера
app.listen(port, () => console.log(`Backend running on port ${port}`));
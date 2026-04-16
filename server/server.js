require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const app = express();
const PORT = 8081;

app.use(cors());
app.use(express.json());

const pool = mysql.createPool({
  host: 'gateway01.ap-northeast-1.prod.aws.tidbcloud.com',
  port: 4000,
  user: '4JDCF27q5TzRWHN.root',
  password: 'Myc5Kx1q5Jhd4pHm', 
  database: 'tcg_db',
  ssl: {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: true
  }
});

// ==========================================
// 🧑‍🤝‍🧑 [유저 및 게임 매치 API]
// ==========================================

app.get('/api/users', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM users');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/users', async (req, res) => {
  const { name } = req.body;
  try {
    await pool.query('INSERT INTO users (name, history) VALUES (?, ?)', [name, JSON.stringify([])]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/match', async (req, res) => {
  const { winnerId, loserId } = req.body;
  const matchId = Date.now();

  try {
    const [[winner]] = await pool.query('SELECT * FROM users WHERE id = ?', [winnerId]);
    const [[loser]] = await pool.query('SELECT * FROM users WHERE id = ?', [loserId]);

    const nextWinStreak = winner.win_streak + 1;
    const addedPoints = nextWinStreak >= 2 ? 5 : 3;
    const winnerSnapshot = JSON.stringify([...(winner.history || []), { 
      points: winner.points, wins: winner.wins, losses: winner.losses, win_streak: winner.win_streak, lose_streak: winner.lose_streak, matchId 
    }]);
    const loserSnapshot = JSON.stringify([...(loser.history || []), { 
      points: loser.points, wins: loser.wins, losses: loser.losses, win_streak: loser.win_streak, lose_streak: loser.lose_streak, matchId 
    }]);

    await pool.query('UPDATE users SET points=points+?, wins=wins+1, win_streak=?, lose_streak=0, history=? WHERE id=?', 
      [addedPoints, nextWinStreak, winnerSnapshot, winnerId]);
    await pool.query('UPDATE users SET points=points+1, losses=losses+1, win_streak=0, lose_streak=lose_streak+1, history=? WHERE id=?', 
      [loserSnapshot, loserId]);

    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/undo', async (req, res) => {
  try {
    const [users] = await pool.query('SELECT id, history FROM users');
    let latestMatchId = 0;

    users.forEach(u => {
      const hist = u.history || [];
      if (hist.length > 0) {
        const lastMatch = hist[hist.length - 1];
        if (lastMatch.matchId > latestMatchId) latestMatchId = lastMatch.matchId;
      }
    });

    if (latestMatchId === 0) return res.status(400).json({ message: "취소할 기록이 없음" });

    for (let u of users) {
      const hist = u.history || [];
      if (hist.length > 0 && hist[hist.length - 1].matchId === latestMatchId) {
        const prevState = hist.pop();
        await pool.query('UPDATE users SET points=?, wins=?, losses=?, win_streak=?, lose_streak=?, history=? WHERE id=?', 
          [prevState.points, prevState.wins, prevState.losses, prevState.win_streak, prevState.lose_streak, JSON.stringify(hist), u.id]);
      }
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/reset', async (req, res) => {
  try {
    await pool.query('UPDATE users SET points=0, wins=0, losses=0, win_streak=0, lose_streak=0, history=JSON_ARRAY()');
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});


// ==========================================
// 🛒 [상점 관리 및 구매 내역 API]
// ==========================================

app.get('/api/shop', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM shop_items');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/shop', async (req, res) => {
  const { name, cost, stock } = req.body;
  try {
    await pool.query('INSERT INTO shop_items (name, cost, stock) VALUES (?, ?, ?)', [name, cost, stock || 0]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/shop/:id', async (req, res) => {
  const { id } = req.params;
  const { name, cost, stock } = req.body;
  try {
    await pool.query('UPDATE shop_items SET name=?, cost=?, stock=? WHERE id=?', [name, cost, stock, id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/shop/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM shop_items WHERE id=?', [id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 💡 상점 상품 구매 (구매 내역 저장 추가)
app.post('/api/buy', async (req, res) => {
  const { userId, cost, itemId } = req.body;
  
  try {
    const [users] = await pool.query('SELECT points FROM users WHERE id = ?', [userId]);
    if (users.length === 0) return res.status(404).json({ error: '유저를 찾을 수 없습니다.' });
    if (users[0].points < cost) return res.status(400).json({ error: '승점이 부족합니다.' });

    // 아이템 정보(이름, 재고) 가져오기
    const [items] = await pool.query('SELECT name, stock FROM shop_items WHERE id = ?', [itemId]);
    if (items.length === 0) return res.status(404).json({ error: '상품을 찾을 수 없습니다.' });
    if (items[0].stock <= 0) return res.status(400).json({ error: '재고가 소진되었습니다.' });

    // 트랜잭션처럼 3가지 쿼리 실행
    // 1. 유저 승점 차감
    await pool.query('UPDATE users SET points = points - ? WHERE id = ?', [cost, userId]);
    // 2. 상점 재고 차감
    await pool.query('UPDATE shop_items SET stock = stock - 1 WHERE id = ?', [itemId]);
    // 3. 구매 내역(purchase_history) 저장
    await pool.query('INSERT INTO purchase_history (user_id, item_name, cost) VALUES (?, ?, ?)', [userId, items[0].name, cost]);
    
    res.json({ success: true, message: '구매 완료' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB 업데이트 중 오류 발생' });
  }
});

// 💡 특정 유저의 구매 내역 조회 API 추가
app.get('/api/purchase-history/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    // 최신 구매 내역이 가장 위로 오도록 내림차순(DESC) 정렬
    const [rows] = await pool.query('SELECT * FROM purchase_history WHERE user_id = ? ORDER BY purchased_at DESC', [userId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 서버 실행
// ==========================================
app.listen(PORT, () => {
  console.log(`🚀 MySQL Server running on port ${PORT}`);
});
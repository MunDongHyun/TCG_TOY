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

// 1. 모든 유저 정보 가져오기
app.get('/api/users', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM users');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. 새 플레이어 추가
app.post('/api/users', async (req, res) => {
  const { name } = req.body;
  try {
    await pool.query('INSERT INTO users (name, history) VALUES (?, ?)', [name, JSON.stringify([])]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. 매치 결과 반영 (승자/패자 동시 업데이트)
app.post('/api/match', async (req, res) => {
  const { winnerId, loserId } = req.body;
  const matchId = Date.now();

  try {
    const [[winner]] = await pool.query('SELECT * FROM users WHERE id = ?', [winnerId]);
    const [[loser]] = await pool.query('SELECT * FROM users WHERE id = ?', [loserId]);

    // 승자 데이터 계산 (기본 3점, 2연승 이상부터 5점)
    const nextWinStreak = winner.win_streak + 1;
    const addedPoints = nextWinStreak >= 2 ? 5 : 3;
    const winnerSnapshot = JSON.stringify([...(winner.history || []), { 
      points: winner.points, wins: winner.wins, losses: winner.losses, 
      win_streak: winner.win_streak, lose_streak: winner.lose_streak, matchId 
    }]);

    // 패자 데이터 계산 (+1점)
    const loserSnapshot = JSON.stringify([...(loser.history || []), { 
      points: loser.points, wins: loser.wins, losses: loser.losses, 
      win_streak: loser.win_streak, lose_streak: loser.lose_streak, matchId 
    }]);

    // DB 업데이트 진행
    await pool.query('UPDATE users SET points=points+?, wins=wins+1, win_streak=?, lose_streak=0, history=? WHERE id=?', 
      [addedPoints, nextWinStreak, winnerSnapshot, winnerId]);
    await pool.query('UPDATE users SET points=points+1, losses=losses+1, win_streak=0, lose_streak=lose_streak+1, history=? WHERE id=?', 
      [loserSnapshot, loserId]);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. 최근 매치 취소 (글로벌 되돌리기)
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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. 전체 데이터 초기화
app.post('/api/reset', async (req, res) => {
  try {
    await pool.query('UPDATE users SET points=0, wins=0, losses=0, win_streak=0, lose_streak=0, history=JSON_ARRAY()');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 MySQL Server running on port ${PORT}`);
});
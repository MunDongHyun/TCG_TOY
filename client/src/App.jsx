import { useState, useEffect } from 'react';
import axios from 'axios';
import './index.css';

// Node.js 서버 주소
const API_URL = 'http://localhost:8081/api';

function App() {
  const [users, setUsers] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);

  // DB에서 데이터 불러오기
  const fetchUsers = async () => {
    try {
      const res = await axios.get(`${API_URL}/users`);
      setUsers(res.data);
    } catch (err) {
      console.error("데이터 로드 실패", err);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleAddPlayer = async () => {
    const name = prompt("추가할 플레이어의 이름을 입력하세요:");
    if (!name) return;
    await axios.post(`${API_URL}/users`, { name });
    fetchUsers();
  };

  const handleMatchResult = async (winnerId, loserId) => {
    await axios.post(`${API_URL}/match`, { winnerId, loserId });
    setSelectedIds([]);
    fetchUsers();
  };

  const handleGlobalUndo = async () => {
    await axios.post(`${API_URL}/undo`);
    fetchUsers();
  };

  const handleResetAll = async () => {
    if (window.confirm("⚠️ 모든 기록을 초기화하시겠습니까? (명단 유지)")) {
      await axios.post(`${API_URL}/reset`);
      fetchUsers();
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(s => s !== id) : prev.length >= 2 ? [prev[1], id] : [...prev, id]);
  };

  const getWinRate = (u) => {
    const total = u.wins + u.losses;
    return total > 0 ? (u.wins / total) : 0;
  };

  // 정렬 로직 (1순위: 승점, 2순위: 승률)
  const sortedUsers = [...users].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return getWinRate(b) - getWinRate(a);
  });

  const playerA = users.find(u => u.id === selectedIds[0]);
  const playerB = users.find(u => u.id === selectedIds[1]);
  const canUndo = users.some(u => u.history && u.history.length > 0);

  return (
    <div className="App">
      <div className="page">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
          <h2>🏆 TCG 실시간 랭킹 (MySQL 연동)</h2>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={handleGlobalUndo} disabled={!canUndo} style={{ backgroundColor: canUndo ? '#f39c12' : '#bdc3c7' }}>⏪ 최근 매치 취소</button>
            <button onClick={handleResetAll} style={{ backgroundColor: '#e67e22' }}>🔄 전체 초기화</button>
            <button onClick={handleAddPlayer} style={{ backgroundColor: '#27ae60' }}>+ 플레이어 추가</button>
          </div>
        </div>

        {selectedIds.length === 2 && (
          <div className="match-status-bar" style={{ backgroundColor: '#2c3e50', color: 'white', padding: '15px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
            <span style={{ fontSize: '18px' }}>⚔️ <strong>{playerA.name}</strong> vs <strong>{playerB.name}</strong></span>
            <div>
              <button onClick={() => handleMatchResult(playerA.id, playerB.id)} style={{ backgroundColor: '#3498db', marginLeft: '10px' }}>{playerA.name} 승리</button>
              <button onClick={() => handleMatchResult(playerB.id, playerA.id)} style={{ backgroundColor: '#e74c3c', marginLeft: '10px' }}>{playerB.name} 승리</button>
              <button onClick={() => setSelectedIds([])} style={{ backgroundColor: '#95a5a6', marginLeft: '10px' }}>취소</button>
            </div>
          </div>
        )}

        <table>
          <thead>
            <tr><th>순위</th><th>이름</th><th>라운드</th><th>승/패</th><th>승률</th><th>현재 연승</th><th>승점</th></tr>
          </thead>
          <tbody>
            {sortedUsers.map((u, index) => {
              const winRate = (getWinRate(u) * 100).toFixed(1);
              const isSelected = selectedIds.includes(u.id);
              let rank = index + 1;
              if (index > 0 && sortedUsers[index-1].points === u.points && getWinRate(sortedUsers[index-1]) === getWinRate(u)) {
                let i = index; while(i > 0 && sortedUsers[i-1].points === u.points && getWinRate(sortedUsers[i-1]) === getWinRate(u)) i--;
                rank = i + 1;
              }
              return (
                <tr key={u.id} onClick={() => toggleSelect(u.id)} style={{ cursor: 'pointer', backgroundColor: isSelected ? '#e3f2fd' : 'transparent', boxShadow: isSelected ? 'inset 0 0 0 2px #3498db' : 'none' }}>
                  <td style={{ fontWeight: 'bold', color: rank === 1 ? '#f39c12' : 'inherit' }}>{rank}위</td>
                  <td><strong>{u.name}</strong> {isSelected && <span style={{ backgroundColor: '#3498db', color: 'white', fontSize: '11px', padding: '3px 6px', borderRadius: '12px', marginLeft: '8px' }}>✓ 선택</span>}</td>
                  <td>{u.wins + u.losses}R</td>
                  <td>{u.wins}승 / {u.losses}패</td>
                  <td>{winRate}%</td>
                  <td>{u.win_streak > 0 ? <span style={{ color: '#2980b9', fontWeight: 'bold' }}>{u.win_streak}연승 🔥</span> : '-'}</td>
                  <td style={{ fontSize: '1.2em', color: '#d35400' }}><strong>{u.points}</strong></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default App;
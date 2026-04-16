import { useState, useEffect } from 'react';
import axios from 'axios';
import './index.css';

// Node.js 서버 주소
const API_URL = 'https://tcg-toy.onrender.com/api';

function App() {
  const [users, setUsers] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  
  // 💡 로딩 상태 관리 추가
  const [isLoading, setIsLoading] = useState(false);
  
  // 상점 관련 상태
  const [isShopOpen, setIsShopOpen] = useState(false);
  const [currentBuyer, setCurrentBuyer] = useState(null);
  const [shopItems, setShopItems] = useState([
    // DB에서 불러오기 전 사용할 임시 데이터 (TCG 테마)
    { id: 1, name: '기본 부스터 팩', cost: 3 },
    { id: 2, name: '프리미엄 카드 슬리브', cost: 5 },
    { id: 3, name: '스페셜 프로모 카드', cost: 10 }
  ]);

  // DB에서 유저 데이터 불러오기
  const fetchUsers = async () => {
    setIsLoading(true); // 통신 시작 시 로딩 ON
    try {
      const res = await axios.get(`${API_URL}/users`);
      setUsers(res.data);
    } catch (err) {
      console.error("데이터 로드 실패", err);
    } finally {
      setIsLoading(false); // 성공/실패 여부 상관없이 통신 끝나면 로딩 OFF
    }
  };

  // (선택사항) DB에서 상점 아이템 불러오기
  const fetchShopItems = async () => {
    try {
      // 백엔드에 /shop 엔드포인트가 생기면 주석 해제하세요!
      // const res = await axios.get(`${API_URL}/shop`);
      // setShopItems(res.data);
    } catch (err) {
      console.error("상점 데이터 로드 실패", err);
    }
  };

  useEffect(() => { 
    fetchUsers(); 
    fetchShopItems();
  }, []);

  const handleAddPlayer = async () => {
    const name = prompt("추가할 플레이어의 이름을 입력하세요:");
    if (!name) return;
    
    setIsLoading(true);
    try {
      await axios.post(`${API_URL}/users`, { name });
      await fetchUsers();
    } catch (err) {
      console.error(err);
      setIsLoading(false);
    }
  };

  const handleMatchResult = async (winnerId, loserId) => {
    setIsLoading(true);
    try {
      await axios.post(`${API_URL}/match`, { winnerId, loserId });
      setSelectedIds([]);
      await fetchUsers();
    } catch (err) {
      console.error(err);
      setIsLoading(false);
    }
  };

  const handleGlobalUndo = async () => {
    setIsLoading(true);
    try {
      await axios.post(`${API_URL}/undo`);
      await fetchUsers();
    } catch (err) {
      console.error(err);
      setIsLoading(false);
    }
  };

  const handleResetAll = async () => {
    if (window.confirm("⚠️ 모든 기록을 초기화하시겠습니까? (명단 유지)")) {
      setIsLoading(true);
      try {
        await axios.post(`${API_URL}/reset`);
        await fetchUsers();
      } catch (err) {
        console.error(err);
        setIsLoading(false);
      }
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(s => s !== id) : prev.length >= 2 ? [prev[1], id] : [...prev, id]);
  };

  const getWinRate = (u) => {
    const total = u.wins + u.losses;
    return total > 0 ? (u.wins / total) : 0;
  };

  // 상점 모달 열기/닫기
  const openShop = (user) => {
    setCurrentBuyer(user);
    setIsShopOpen(true);
  };

  const closeShop = () => {
    setIsShopOpen(false);
    setCurrentBuyer(null);
  };

  // 상품 구매 로직
  const handlePurchase = async (item) => {
    if (currentBuyer.points < item.cost) {
      alert(`승점이 부족합니다! (현재: ${currentBuyer.points}점 / 필요: ${item.cost}점)`);
      return;
    }

    if (window.confirm(`[${item.name}]을(를) ${item.cost}점에 구매하시겠습니까?`)) {
      setIsLoading(true);
      try {
        await axios.post(`${API_URL}/buy`, { 
          userId: currentBuyer.id, 
          cost: item.cost 
        });
        alert("구매 완료!");
        await fetchUsers(); 
        closeShop();
      } catch (err) {
        console.error("구매 실패", err);
        alert("구매 처리 중 오류가 발생했습니다.");
        setIsLoading(false);
      }
    }
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
      {/* 💡 로딩 중일 때 화면 전체를 덮는 오버레이 표시 */}
      {isLoading && (
        <div style={loadingOverlayStyle}>
          <div style={spinnerStyle}></div>
          <h3 style={{ color: '#2c3e50', marginTop: '15px' }}>DB와 통신 중입니다... ⏳</h3>
        </div>
      )}

      <div className="page">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
          <h2>실시간 랭킹</h2>
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
            <tr>
              <th>순위</th><th>이름</th><th>라운드</th><th>승/패</th><th>승률</th><th>현재 연승</th><th>승점</th><th>상점</th>
            </tr>
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
                  <td>
                    {/* 상점 버튼: 클릭 이벤트가 tr로 전파되는 것을 막음 */}
                    <button 
                      onClick={(e) => { e.stopPropagation(); openShop(u); }}
                      style={{ padding: '4px 8px', fontSize: '12px', backgroundColor: '#8e44ad' }}
                    >
                      🛒 상점
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* 상점 모달창 UI */}
      {isShopOpen && currentBuyer && (
        <div className="modal-overlay" style={modalOverlayStyle}>
          <div className="modal-content" style={modalContentStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #eee', paddingBottom: '10px', marginBottom: '15px' }}>
              <h3 style={{ margin: 0 }}>🛒 {currentBuyer.name}님의 상점</h3>
              <span style={{ fontWeight: 'bold', color: '#d35400' }}>보유 승점: {currentBuyer.points}점</span>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {shopItems.map(item => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}>
                  <span>{item.name}</span>
                  <button 
                    onClick={() => handlePurchase(item)}
                    style={{ backgroundColor: currentBuyer.points >= item.cost ? '#27ae60' : '#bdc3c7' }}
                  >
                    {item.cost}점 구매
                  </button>
                </div>
              ))}
            </div>

            <button onClick={closeShop} style={{ marginTop: '20px', width: '100%', backgroundColor: '#7f8c8d' }}>닫기</button>
          </div>
        </div>
      )}
    </div>
  );
}

// 💡 새롭게 추가된 로딩 오버레이 스타일
const loadingOverlayStyle = {
  position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
  backgroundColor: 'rgba(255, 255, 255, 0.8)', display: 'flex', flexDirection: 'column',
  justifyContent: 'center', alignItems: 'center', zIndex: 9999, backdropFilter: 'blur(3px)'
};

const spinnerStyle = {
  width: '50px', height: '50px', border: '5px solid #f3f3f3', borderTop: '5px solid #3498db',
  borderRadius: '50%', animation: 'spin 1s linear infinite'
};

// 기존 모달창 스타일
const modalOverlayStyle = {
  position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
  backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
};

const modalContentStyle = {
  backgroundColor: 'white', padding: '25px', borderRadius: '8px',
  width: '350px', maxWidth: '90%', boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
};

// CSS 애니메이션용 스타일 주입 (회전하는 스피너)
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.innerHTML = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
}

export default App;
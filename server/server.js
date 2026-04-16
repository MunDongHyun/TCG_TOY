import { useState, useEffect } from 'react';
import axios from 'axios';
import './index.css';

// Node.js 서버 주소 (본인의 서버 주소로 확인)
const API_URL = 'https://tcg-toy.onrender.com/api';

// ==========================================
// [1] 최상위 App 컴포넌트 (탭 라우팅)
// ==========================================
export default function App() {
  const [currentPage, setCurrentPage] = useState('main');

  return (
    <div className="App">
      {/* 네비게이션 탭 */}
      <div style={navBarStyle}>
        <button
          onClick={() => setCurrentPage('main')}
          style={currentPage === 'main' ? activeTabStyle : inactiveTabStyle}
        >
          🏆 실시간 랭킹
        </button>
        <button
          onClick={() => setCurrentPage('shopAdmin')}
          style={currentPage === 'shopAdmin' ? activeTabStyle : inactiveTabStyle}
        >
          ⚙️ 상점 관리자
        </button>
      </div>

      {currentPage === 'main' ? <MainPage /> : <ShopAdmin />}
    </div>
  );
}

// ==========================================
// [2] 메인 페이지 (랭킹 & DB 연동 상점 구매)
// ==========================================
function MainPage() {
  const [users, setUsers] = useState([]);
  const [shopItems, setShopItems] = useState([]); // 💡 DB에서 가져올 빈 배열로 초기화
  const [selectedIds, setSelectedIds] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const [isShopOpen, setIsShopOpen] = useState(false);
  const [currentBuyer, setCurrentBuyer] = useState(null);

  // 유저 정보 불러오기
  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const res = await axios.get(`${API_URL}/users`);
      setUsers(res.data);
    } catch (err) {
      console.error("유저 로드 실패", err);
    } finally {
      setIsLoading(false);
    }
  };

  // 💡 DB에서 상점 상품 목록 불러오기
  const fetchShopItems = async () => {
    try {
      const res = await axios.get(`${API_URL}/shop`);
      setShopItems(res.data);
    } catch (err) {
      console.error("상점 아이템 로드 실패", err);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchShopItems();
  }, []);

  // 결과 처리 및 각종 핸들러 (기존과 동일)
  const handleMatchResult = async (winnerId, loserId) => {
    setIsLoading(true);
    try {
      await axios.post(`${API_URL}/match`, { winnerId, loserId });
      setSelectedIds([]);
      await fetchUsers();
    } catch (err) { setIsLoading(false); }
  };

  const handleAddPlayer = async () => {
    const name = prompt("추가할 플레이어의 이름을 입력하세요:");
    if (!name) return;
    setIsLoading(true);
    try {
      await axios.post(`${API_URL}/users`, { name });
      await fetchUsers();
    } catch (err) { setIsLoading(false); }
  };

  const handleGlobalUndo = async () => {
    setIsLoading(true);
    try {
      await axios.post(`${API_URL}/undo`);
      await fetchUsers();
    } catch (err) { setIsLoading(false); }
  };

  const handleResetAll = async () => {
    if (window.confirm("⚠️ 전체 초기화하시겠습니까?")) {
      setIsLoading(true);
      try {
        await axios.post(`${API_URL}/reset`);
        await fetchUsers();
      } catch (err) { setIsLoading(false); }
    }
  };

  // 상점 구매 로직
  const handlePurchase = async (item) => {
    if (currentBuyer.points < item.cost) {
      alert(`승점이 부족합니다! (현재: ${currentBuyer.points}점 / 필요: ${item.cost}점)`);
      return;
    }
    if (window.confirm(`[${item.name}]을(를) ${item.cost}점에 구매하시겠습니까?`)) {
      setIsLoading(true);
      try {
        await axios.post(`${API_URL}/buy`, { userId: currentBuyer.id, cost: item.cost });
        alert("구매 완료!");
        await fetchUsers();
        closeShop();
      } catch (err) {
        alert("구매 중 오류 발생");
        setIsLoading(false);
      }
    }
  };

  const openShop = (user) => { setCurrentBuyer(user); setIsShopOpen(true); };
  const closeShop = () => { setIsShopOpen(false); setCurrentBuyer(null); };

  const getWinRate = (u) => (u.wins + u.losses > 0 ? (u.wins / (u.wins + u.losses)) : 0);
  const sortedUsers = [...users].sort((a, b) => b.points !== a.points ? b.points - a.points : getWinRate(b) - getWinRate(a));
  const playerA = users.find(u => u.id === selectedIds[0]);
  const playerB = users.find(u => u.id === selectedIds[1]);

  return (
    <div className="page">
      {isLoading && <LoadingOverlay />}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h2>실시간 랭킹</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={handleGlobalUndo} style={{ backgroundColor: '#f39c12' }}>⏪ 최근 매치 취소</button>
          <button onClick={handleResetAll} style={{ backgroundColor: '#e67e22' }}>🔄 전체 초기화</button>
          <button onClick={handleAddPlayer} style={{ backgroundColor: '#27ae60' }}>+ 플레이어 추가</button>
        </div>
      </div>

      {selectedIds.length === 2 && (
        <div className="match-status-bar" style={matchBarStyle}>
          <span>⚔️ {playerA.name} vs {playerB.name}</span>
          <div>
            <button onClick={() => handleMatchResult(playerA.id, playerB.id)} style={{ backgroundColor: '#3498db' }}>승리</button>
            <button onClick={() => handleMatchResult(playerB.id, playerA.id)} style={{ backgroundColor: '#e74c3c' }}>승리</button>
            <button onClick={() => setSelectedIds([])} style={{ backgroundColor: '#95a5a6' }}>취소</button>
          </div>
        </div>
      )}

      <table>
        <thead>
          <tr><th>순위</th><th>이름</th><th>라운드</th><th>승/패</th><th>승률</th><th>승점</th><th>상점</th></tr>
        </thead>
        <tbody>
          {sortedUsers.map((u, i) => (
            <tr key={u.id} onClick={() => setSelectedIds(prev => prev.includes(u.id) ? prev.filter(s => s !== u.id) : [...prev].slice(-1).concat(u.id))} style={{ backgroundColor: selectedIds.includes(u.id) ? '#e3f2fd' : '' }}>
              <td>{i + 1}위</td>
              <td><strong>{u.name}</strong></td>
              <td>{u.wins + u.losses}R</td>
              <td>{u.wins}승 / {u.losses}패</td>
              <td>{(getWinRate(u) * 100).toFixed(1)}%</td>
              <td style={{ color: '#d35400' }}><strong>{u.points}</strong></td>
              <td><button onClick={(e) => { e.stopPropagation(); openShop(u) }} style={{ backgroundColor: '#8e44ad' }}>🛒 상점</button></td>
            </tr>
          ))}
        </tbody>
      </table>

      {isShopOpen && (
        <div className="modal-overlay" style={modalOverlayStyle}>
          <div className="modal-content" style={modalContentStyle}>
            <h3>🛒 {currentBuyer.name}님의 상점 (보유: {currentBuyer.points}점)</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {shopItems.length > 0 ? shopItems.map(item => (
                <div key={item.id} style={shopItemCardStyle}>
                  <span>{item.name} ({item.cost}점)</span>
                  <button onClick={() => handlePurchase(item)} style={{ backgroundColor: currentBuyer.points >= item.cost ? '#27ae60' : '#bdc3c7' }}>구매</button>
                </div>
              )) : <p>상점에 상품이 없습니다.</p>}
            </div>
            <button onClick={closeShop} style={{ marginTop: '20px', width: '100%', backgroundColor: '#7f8c8d' }}>닫기</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// [3] 상점 관리자 페이지 (CRUD)
// ==========================================
function ShopAdmin() {
  const [shopItems, setShopItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [form, setForm] = useState({ name: '', cost: '' });
  const [editingId, setEditingId] = useState(null);

  const fetchItems = async () => {
    setIsLoading(true);
    try {
      const res = await axios.get(`${API_URL}/shop`);
      setShopItems(res.data);
    } finally { setIsLoading(false); }
  };

  useEffect(() => { fetchItems(); }, []);

  const handleAdd = async () => {
    if (!form.name || !form.cost) return alert("입력 필요");
    setIsLoading(true);
    await axios.post(`${API_URL}/shop`, { name: form.name, cost: Number(form.cost) });
    setForm({ name: '', cost: '' });
    fetchItems();
  };

  const handleDelete = async (id) => {
    if (!window.confirm("삭제할까요?")) return;
    setIsLoading(true);
    await axios.delete(`${API_URL}/shop/${id}`);
    fetchItems();
  };

  const handleUpdate = async (id) => {
    setIsLoading(true);
    await axios.put(`${API_URL}/shop/${id}`, { name: form.name, cost: Number(form.cost) });
    setEditingId(null);
    setForm({ name: '', cost: '' });
    fetchItems();
  };

  return (
    <div className="page">
      {isLoading && <LoadingOverlay />}
      <h2>⚙️ 상점 아이템 관리</h2>
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', background: '#eee', padding: '15px', borderRadius: '8px' }}>
        <input placeholder="상품명" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
        <input type="number" placeholder="가격" value={form.cost} onChange={e => setForm({ ...form, cost: e.target.value })} />
        {editingId ? (
          <button onClick={() => handleUpdate(editingId)} style={{ backgroundColor: '#3498db' }}>수정 완료</button>
        ) : (
          <button onClick={handleAdd} style={{ backgroundColor: '#27ae60' }}>상품 등록</button>
        )}
      </div>

      <table>
        <thead><tr><th>상품명</th><th>가격</th><th>관리</th></tr></thead>
        <tbody>
          {shopItems.map(item => (
            <tr key={item.id}>
              <td>{item.name}</td>
              <td>{item.cost}점</td>
              <td>
                <button onClick={() => { setEditingId(item.id); setForm({ name: item.name, cost: item.cost }) }} style={{ backgroundColor: '#f39c12', marginRight: '5px' }}>수정</button>
                <button onClick={() => handleDelete(item.id)} style={{ backgroundColor: '#e74c3c' }}>삭제</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ==========================================
// [4] 스타일 및 공통 컴포넌트
// ==========================================
function LoadingOverlay() {
  return (
    <div style={loadingOverlayStyle}>
      <div className="spinner"></div>
      <p>통신 중...</p>
    </div>
  );
}

const navBarStyle = { display: 'flex', justifyContent: 'center', gap: '10px', padding: '15px', backgroundColor: '#2c3e50', marginBottom: '20px' };
const activeTabStyle = { backgroundColor: '#3498db', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '5px', cursor: 'pointer' };
const inactiveTabStyle = { backgroundColor: 'transparent', color: '#bdc3c7', padding: '10px 20px', border: '1px solid #7f8c8d', borderRadius: '5px', cursor: 'pointer' };
const matchBarStyle = { backgroundColor: '#2c3e50', color: 'white', padding: '15px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', marginBottom: '20px' };
const modalOverlayStyle = { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 };
const modalContentStyle = { backgroundColor: 'white', padding: '25px', borderRadius: '8px', width: '400px' };
const shopItemCardStyle = { display: 'flex', justifyContent: 'space-between', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' };
const loadingOverlayStyle = { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(255,255,255,0.7)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', zIndex: 9999 };

// CSS Spinner
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.innerHTML = `.spinner { width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #3498db; border-radius: 50%; animation: spin 1s linear infinite; } @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`;
  document.head.appendChild(style);
}


// [데이터 예시 - 실제로는 DB(SQLite, MongoDB 등) 사용 권장]
let shopItems = [
  { id: 1, name: '부스터 팩', cost: 3 },
  { id: 2, name: '카드 슬리브', cost: 5 }
];

// 1. 상점 아이템 전체 목록 조회
app.get('/api/shop', (req, res) => {
  res.json(shopItems);
});

// 2. 새 아이템 추가
app.post('/api/shop', (req, res) => {
  const { name, cost } = req.body;
  const newItem = { id: Date.now(), name, cost };
  shopItems.push(newItem);
  res.json(newItem);
});

// 3. 아이템 수정
app.put('/api/shop/:id', (req, res) => {
  const { id } = req.params;
  const { name, cost } = req.body;
  shopItems = shopItems.map(item => item.id == id ? { ...item, name, cost } : item);
  res.json({ success: true });
});

// 4. 아이템 삭제
app.delete('/api/shop/:id', (req, res) => {
  const { id } = req.params;
  shopItems = shopItems.filter(item => item.id != id);
  res.json({ success: true });
});

// 5. 상품 구매 (승점 차감 로직)
app.post('/api/buy', (req, res) => {
  const { userId, cost } = req.body;
  // DB에서 유저 찾아서 points 차감하는 로직 수행
  const user = users.find(u => u.id === userId);
  if (user && user.points >= cost) {
    user.points -= cost;
    res.json({ success: true });
  } else {
    res.status(400).json({ message: "포인트 부족" });
  }
});
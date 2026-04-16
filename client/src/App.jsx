import { useState, useEffect } from 'react';
import axios from 'axios';
import './index.css';

// Node.js 서버 주소
const API_URL = 'https://tcg-toy.onrender.com/api';

// ==========================================
// [1] 최상위 App 컴포넌트 (탭 메뉴 라우팅)
// ==========================================
export default function App() {
  const [currentPage, setCurrentPage] = useState('main'); // 'main' 또는 'shopAdmin'

  return (
    <div className="App">
      {/* 💡 상단 관리자 이동 탭 버튼 */}
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
          ⚙️ 상점 아이템 관리
        </button>
      </div>

      {currentPage === 'main' ? <MainPage /> : <ShopAdmin />}
    </div>
  );
}

// ==========================================
// [2] 메인 페이지 (랭킹 & 상점 구매)
// ==========================================
function MainPage() {
  const [users, setUsers] = useState([]);
  const [shopItems, setShopItems] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isShopOpen, setIsShopOpen] = useState(false);
  const [currentBuyer, setCurrentBuyer] = useState(null);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const res = await axios.get(`${API_URL}/users`);
      setUsers(res.data);
    } catch (err) { console.error("데이터 로드 실패", err); } 
    finally { setIsLoading(false); }
  };

  const fetchShopItems = async () => {
    try {
      const res = await axios.get(`${API_URL}/shop`);
      setShopItems(res.data);
    } catch (err) { console.error("상점 데이터 로드 실패", err); }
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
    } catch (err) { setIsLoading(false); }
  };

  const handleMatchResult = async (winnerId, loserId) => {
    setIsLoading(true);
    try {
      await axios.post(`${API_URL}/match`, { winnerId, loserId });
      setSelectedIds([]);
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
        setIsShopOpen(false);
      } catch (err) { alert("구매 처리 중 오류 발생"); setIsLoading(false); }
    }
  };

  const toggleSelect = (id) => setSelectedIds(prev => prev.includes(id) ? prev.filter(s => s !== id) : prev.length >= 2 ? [prev[1], id] : [...prev, id]);
  const getWinRate = (u) => (u.wins + u.losses > 0 ? (u.wins / (u.wins + u.losses)) : 0);
  
  const sortedUsers = [...users].sort((a, b) => b.points !== a.points ? b.points - a.points : getWinRate(b) - getWinRate(a));
  const playerA = users.find(u => u.id === selectedIds[0]);
  const playerB = users.find(u => u.id === selectedIds[1]);
  const canUndo = users.some(u => u.history && u.history.length > 0);

  return (
    <div className="page">
      {isLoading && <LoadingOverlay />}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h2>실시간 랭킹</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={handleGlobalUndo} disabled={!canUndo} style={{ backgroundColor: canUndo ? '#f39c12' : '#bdc3c7' }}>⏪ 취소</button>
          <button onClick={handleResetAll} style={{ backgroundColor: '#e67e22' }}>🔄 초기화</button>
          <button onClick={handleAddPlayer} style={{ backgroundColor: '#27ae60' }}>+ 플레이어</button>
        </div>
      </div>

      {selectedIds.length === 2 && (
        <div className="match-status-bar" style={matchBarStyle}>
          <span>⚔️ <strong>{playerA.name}</strong> vs <strong>{playerB.name}</strong></span>
          <div>
            <button onClick={() => handleMatchResult(playerA.id, playerB.id)} style={{backgroundColor:'#3498db', marginLeft:'10px'}}>승리</button>
            <button onClick={() => handleMatchResult(playerB.id, playerA.id)} style={{backgroundColor:'#e74c3c', marginLeft:'10px'}}>승리</button>
            <button onClick={() => setSelectedIds([])} style={{backgroundColor:'#95a5a6', marginLeft:'10px'}}>취소</button>
          </div>
        </div>
      )}

      <table>
        <thead>
          <tr><th>순위</th><th>이름</th><th>라운드</th><th>승/패</th><th>승률</th><th>연승</th><th>승점</th><th>상점</th></tr>
        </thead>
        <tbody>
          {sortedUsers.map((u, i) => (
            <tr key={u.id} onClick={() => toggleSelect(u.id)} style={{ backgroundColor: selectedIds.includes(u.id) ? '#e3f2fd' : 'transparent' }}>
              <td>{i + 1}위</td>
              <td><strong>{u.name}</strong></td>
              <td>{u.wins + u.losses}R</td>
              <td>{u.wins}승 / {u.losses}패</td>
              <td>{(getWinRate(u)*100).toFixed(1)}%</td>
              <td>{u.win_streak > 0 ? `${u.win_streak}연승 🔥` : '-'}</td>
              <td style={{color:'#d35400', fontWeight:'bold'}}>{u.points}</td>
              <td><button onClick={(e)=>{e.stopPropagation(); setCurrentBuyer(u); setIsShopOpen(true);}} style={{backgroundColor:'#8e44ad', fontSize:'12px'}}>🛒</button></td>
            </tr>
          ))}
        </tbody>
      </table>

      {isShopOpen && currentBuyer && (
        <div className="modal-overlay" style={modalOverlayStyle}>
          <div className="modal-content" style={modalContentStyle}>
            <h3>🛒 {currentBuyer.name}님의 상점 (보유: {currentBuyer.points}점)</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {shopItems.map(item => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', border: '1px solid #ddd' }}>
                  <span>{item.name}</span>
                  <button onClick={() => handlePurchase(item)} style={{ backgroundColor: currentBuyer.points >= item.cost ? '#27ae60' : '#bdc3c7' }}>{item.cost}점 구매</button>
                </div>
              ))}
            </div>
            <button onClick={() => setIsShopOpen(false)} style={{ marginTop: '20px', width: '100%', backgroundColor: '#7f8c8d' }}>닫기</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// [3] 상점 아이템 관리자 페이지
// ==========================================
function ShopAdmin() {
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [form, setForm] = useState({ name: '', cost: '' });
  const [editId, setEditId] = useState(null);

  const fetchItems = async () => {
    setIsLoading(true);
    try { const res = await axios.get(`${API_URL}/shop`); setItems(res.data); } 
    finally { setIsLoading(false); }
  };

  useEffect(() => { fetchItems(); }, []);

  const handleSave = async () => {
    if (!form.name || !form.cost) return;
    setIsLoading(true);
    try {
      if (editId) await axios.put(`${API_URL}/shop/${editId}`, form);
      else await axios.post(`${API_URL}/shop`, form);
      setForm({ name: '', cost: '' }); setEditId(null); await fetchItems();
    } catch(err) { setIsLoading(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("삭제할까요?")) return;
    setIsLoading(true);
    try { await axios.delete(`${API_URL}/shop/${id}`); await fetchItems(); } 
    catch(err) { setIsLoading(false); }
  };

  return (
    <div className="page">
      {isLoading && <LoadingOverlay />}
      <h2>⚙️ 상점 아이템 관리</h2>
      <div style={{ display:'flex', gap:'10px', background:'#eee', padding:'15px', borderRadius:'8px', marginBottom:'20px' }}>
        <input placeholder="상품명" value={form.name} onChange={e=>setForm({...form, name: e.target.value})} />
        <input type="number" placeholder="가격" value={form.cost} onChange={e=>setForm({...form, cost: e.target.value})} />
        <button onClick={handleSave} style={{backgroundColor:'#27ae60'}}>{editId ? '수정완료' : '+ 등록'}</button>
        {editId && <button onClick={()=>{setEditId(null); setForm({name:'', cost:''})}} style={{backgroundColor:'#7f8c8d'}}>취소</button>}
      </div>

      <table>
        <thead><tr><th>상품명</th><th>가격</th><th>관리</th></tr></thead>
        <tbody>
          {items.map(item => (
            <tr key={item.id}>
              <td>{item.name}</td><td>{item.cost}점</td>
              <td>
                <button onClick={()=>{setEditId(item.id); setForm({name: item.name, cost: item.cost})}} style={{backgroundColor:'#f39c12', marginRight:'5px'}}>수정</button>
                <button onClick={()=>handleDelete(item.id)} style={{backgroundColor:'#e74c3c'}}>삭제</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ==========================================
// [4] 공통 UI 스타일 정의
// ==========================================
function LoadingOverlay() {
  return (
    <div style={loadingOverlayStyle}>
      <div style={spinnerStyle}></div><h3 style={{marginTop:'15px', color:'#2c3e50'}}>DB 통신 중... ⏳</h3>
    </div>
  );
}

const navBarStyle = { display: 'flex', justifyContent: 'center', gap: '10px', padding: '15px', backgroundColor: '#f1f2f6', marginBottom: '20px', borderRadius: '8px' };
const activeTabStyle = { backgroundColor: '#3498db', padding: '10px 20px', borderRadius: '5px', color: 'white', fontWeight: 'bold', border: 'none', cursor: 'pointer' };
const inactiveTabStyle = { backgroundColor: 'white', padding: '10px 20px', color: '#7f8c8d', border: '1px solid #bdc3c7', borderRadius: '5px', cursor: 'pointer' };
const matchBarStyle = { backgroundColor: '#2c3e50', color: 'white', padding: '15px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', marginBottom: '20px' };
const modalOverlayStyle = { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 };
const modalContentStyle = { backgroundColor: 'white', padding: '25px', borderRadius: '8px', width: '350px', maxWidth: '90%' };
const loadingOverlayStyle = { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(255,255,255,0.8)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', zIndex: 9999, backdropFilter: 'blur(3px)' };
const spinnerStyle = { width: '50px', height: '50px', border: '5px solid #f3f3f3', borderTop: '5px solid #3498db', borderRadius: '50%', animation: 'spin 1s linear infinite' };

if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.innerHTML = `@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`;
  document.head.appendChild(style);
}
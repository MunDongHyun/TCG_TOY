import { useState, useEffect } from 'react';
import axios from 'axios';
import './index.css';

const API_URL = 'https://tcg-toy.onrender.com/api';

export default function App() {
  const [currentPage, setCurrentPage] = useState('main');

  return (
    <div className="App">
      <div style={navBarStyle}>
        <button onClick={() => setCurrentPage('main')} style={currentPage === 'main' ? activeTabStyle : inactiveTabStyle}>🏆 실시간 랭킹</button>
        <button onClick={() => setCurrentPage('shopAdmin')} style={currentPage === 'shopAdmin' ? activeTabStyle : inactiveTabStyle}>⚙️ 상점 아이템 관리</button>
      </div>
      {currentPage === 'main' ? <MainPage /> : <ShopAdmin />}
    </div>
  );
}

// ==========================================
// [2] 메인 페이지 (상점 재고 연동 및 구매)
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
    } catch (err) { console.error(err); } finally { setIsLoading(false); }
  };

  const fetchShopItems = async () => {
    try {
      const res = await axios.get(`${API_URL}/shop`);
      setShopItems(res.data);
    } catch (err) { console.error(err); }
  };

  useEffect(() => { fetchUsers(); fetchShopItems(); }, []);

  const handleAddPlayer = async () => {
    const name = prompt("추가할 플레이어의 이름을 입력하세요:");
    if (!name) return;
    setIsLoading(true);
    await axios.post(`${API_URL}/users`, { name });
    await fetchUsers();
  };

  const handleMatchResult = async (winnerId, loserId) => {
    setIsLoading(true);
    await axios.post(`${API_URL}/match`, { winnerId, loserId });
    setSelectedIds([]);
    await fetchUsers();
  };

  const handleGlobalUndo = async () => {
    setIsLoading(true);
    await axios.post(`${API_URL}/undo`);
    await fetchUsers();
  };

  const handleResetAll = async () => {
    if (window.confirm("⚠️ 전체 초기화하시겠습니까?")) {
      setIsLoading(true);
      await axios.post(`${API_URL}/reset`);
      await fetchUsers();
    }
  };

  const handlePurchase = async (item) => {
    if (currentBuyer.points < item.cost) {
      return alert(`승점이 부족합니다! (현재: ${currentBuyer.points}점 / 필요: ${item.cost}점)`);
    }
    if (item.stock <= 0) {
      return alert("재고가 모두 소진되었습니다!");
    }

    if (window.confirm(`[${item.name}]을(를) ${item.cost}점에 구매하시겠습니까? (남은 수량: ${item.stock}개)`)) {
      setIsLoading(true);
      try {
        // 구매 시 아이템 ID(itemId)도 함께 넘겨줍니다.
        await axios.post(`${API_URL}/buy`, { userId: currentBuyer.id, cost: item.cost, itemId: item.id });
        alert("구매 완료!");
        await fetchUsers(); 
        await fetchShopItems(); // 재고 갱신을 위해 상점 목록 다시 불러오기
        setIsShopOpen(false);
      } catch (err) { 
        alert(err.response?.data?.error || "구매 처리 중 오류 발생"); 
        setIsLoading(false); 
      }
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
            <tr key={u.id} onClick={() => toggleSelect(u.id)} style={{ backgroundColor: selectedIds.includes(u.id) ? '#e3f2fd' : 'transparent', cursor: 'pointer' }}>
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
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', border: '1px solid #ddd' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 'bold' }}>{item.name}</span>
                    <span style={{ fontSize: '12px', color: item.stock > 0 ? '#27ae60' : '#e74c3c' }}>
                      {item.stock > 0 ? `남은 수량: ${item.stock}개` : '품절 (Sold Out)'}
                    </span>
                  </div>
                  <button 
                    onClick={() => handlePurchase(item)} 
                    disabled={item.stock <= 0}
                    style={{ backgroundColor: (currentBuyer.points >= item.cost && item.stock > 0) ? '#27ae60' : '#bdc3c7' }}
                  >
                    {item.cost}점 구매
                  </button>
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
// [3] 상점 아이템 관리자 페이지 (인라인 수정)
// ==========================================
function ShopAdmin() {
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // 새 상품 추가 폼
  const [form, setForm] = useState({ name: '', cost: '', stock: '' });
  
  // 특정 행 인라인 수정 폼
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', cost: '', stock: '' });

  const fetchItems = async () => {
    setIsLoading(true);
    try { const res = await axios.get(`${API_URL}/shop`); setItems(res.data); } 
    finally { setIsLoading(false); }
  };

  useEffect(() => { fetchItems(); }, []);

  // 새 상품 추가
  const handleAdd = async () => {
    if (!form.name || !form.cost || !form.stock) return alert("상품명, 가격, 수량을 모두 입력해주세요.");
    setIsLoading(true);
    try {
      await axios.post(`${API_URL}/shop`, { name: form.name, cost: Number(form.cost), stock: Number(form.stock) });
      setForm({ name: '', cost: '', stock: '' }); 
      await fetchItems();
    } catch(err) { setIsLoading(false); }
  };

  // 인라인 수정 모드 켜기
  const startEdit = (item) => {
    setEditingId(item.id);
    setEditForm({ name: item.name, cost: item.cost, stock: item.stock });
  };

  // 인라인 수정 완료 (저장)
  const saveEdit = async (id) => {
    if (!editForm.name || !editForm.cost || editForm.stock === '') return alert("모든 값을 입력해주세요.");
    setIsLoading(true);
    try {
      await axios.put(`${API_URL}/shop/${id}`, { name: editForm.name, cost: Number(editForm.cost), stock: Number(editForm.stock) });
      setEditingId(null);
      await fetchItems();
    } catch (err) { setIsLoading(false); }
  };

  // 상품 삭제
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
      
      {/* 새 상품 등록 영역 */}
      <div style={{ display:'flex', gap:'10px', background:'#eee', padding:'15px', borderRadius:'8px', marginBottom:'20px' }}>
        <input placeholder="상품명" value={form.name} onChange={e=>setForm({...form, name: e.target.value})} style={{ flex: 2 }}/>
        <input type="number" placeholder="가격(승점)" value={form.cost} onChange={e=>setForm({...form, cost: e.target.value})} style={{ flex: 1 }}/>
        <input type="number" placeholder="초기 수량" value={form.stock} onChange={e=>setForm({...form, stock: e.target.value})} style={{ flex: 1 }}/>
        <button onClick={handleAdd} style={{backgroundColor:'#27ae60'}}>+ 상품 등록</button>
      </div>

      <table>
        <thead><tr><th>ID</th><th>상품명</th><th>가격</th><th>재고 수량</th><th>관리</th></tr></thead>
        <tbody>
          {items.map(item => (
            <tr key={item.id}>
              <td>{item.id}</td>
              {editingId === item.id ? (
                // 💡 인라인 수정 모드 (해당 행이 입력창으로 변함)
                <>
                  <td><input type="text" value={editForm.name} onChange={e=>setEditForm({...editForm, name: e.target.value})} style={{ width: '100%', padding: '5px' }} /></td>
                  <td><input type="number" value={editForm.cost} onChange={e=>setEditForm({...editForm, cost: e.target.value})} style={{ width: '60px', padding: '5px' }} /></td>
                  <td><input type="number" value={editForm.stock} onChange={e=>setEditForm({...editForm, stock: e.target.value})} style={{ width: '60px', padding: '5px' }} /></td>
                  <td>
                    <button onClick={() => saveEdit(item.id)} style={{backgroundColor:'#3498db', marginRight:'5px'}}>저장</button>
                    <button onClick={() => setEditingId(null)} style={{backgroundColor:'#95a5a6'}}>취소</button>
                  </td>
                </>
              ) : (
                // 💡 일반 모드
                <>
                  <td>{item.name}</td>
                  <td style={{ color: '#d35400', fontWeight: 'bold' }}>{item.cost}점</td>
                  <td>{item.stock}개</td>
                  <td>
                    <button onClick={() => startEdit(item)} style={{backgroundColor:'#f39c12', marginRight:'5px'}}>수정</button>
                    <button onClick={() => handleDelete(item.id)} style={{backgroundColor:'#e74c3c'}}>삭제</button>
                  </td>
                </>
              )}
            </tr>
          ))}
          {items.length === 0 && <tr><td colSpan="5" style={{ textAlign: 'center', padding: '20px' }}>등록된 상품이 없습니다.</td></tr>}
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
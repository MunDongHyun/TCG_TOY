import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

const API_URL = 'https://tcg-toy.onrender.com/api';

function App() {
  const [users, setUsers] = useState([]);
  const [newName, setNewName] = useState('');

  // 1. 유저 목록 불러오기
  const fetchUsers = async () => {
    try {
      const res = await axios.get(`${API_URL}/users`);
      setUsers(res.data);
    } catch (err) {
      console.error("데이터 로드 실패", err);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // 2. 플레이어 추가
  const addUser = async () => {
    if (!newName) return;
    try {
      await axios.post(`${API_URL}/users`, { name: newName });
      setNewName('');
      fetchUsers();
    } catch (err) {
      alert("추가 실패!");
    }
  };

  return (
    <div className="bono-app">
      {/* 캐릭터들 (public 폴더에 이미지가 있어야 함) */}
      <img src="/bonobono.png" className="char-bono" alt="보노보노" />
      <img src="/porori.png" className="char-porori" alt="포로리" />
      <img src="/neuburi.png" className="char-neuburi" alt="너부리" />

      <h1 className="bono-title">🌊 TCG 실시간 랭킹 (MySQL 연동) 🌊</h1>

      <div className="bono-table-container">
        <table className="bono-table">
          <thead>
            <tr>
              <th>순위</th>
              <th>이름</th>
              <th>승률</th>
              <th>전적</th>
              <th>승점</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user, index) => (
              <tr key={user.id}>
                <td>{index + 1}위</td>
                <td>{user.name}</td>
                <td>
                  {((user.wins / (user.wins + user.losses || 1)) * 100).toFixed(1)}%
                </td>
                <td>{user.wins}승 {user.losses}패</td>
                <td className="points-red">{user.points}점</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="input-section">
        <h2 style={{ marginBottom: '10px' }}>자! 플레이어를 추가해보자!</h2>
        <input 
          className="bono-input"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="이름 입력해용~"
        />
        <button className="bono-btn" onClick={addUser}>등록하기!</button>
      </div>

      <p style={{ marginTop: '20px', fontWeight: 'bold' }}>
        Host: MunDongHyun (2026 TCG SYSTEM)
      </p>
    </div>
  );
}

export default App;
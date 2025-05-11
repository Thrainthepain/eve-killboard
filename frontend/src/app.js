// frontend/src/App.js
import React, { useEffect, useState } from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import axios from 'axios';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';

function App() {
  const [auth, setAuth] = useState({ isLoggedIn: false, user: null });

  useEffect(() => {
    axios.get(`${process.env.REACT_APP_API_BASE}/api/auth/status`, { withCredentials: true })
      .then(res => setAuth(res.data))
      .catch(() => setAuth({ isLoggedIn: false }));
  }, []);

  return (
    <div>
      <nav>
        <Link to="/">Home</Link> |
        {auth.isLoggedIn ? <Link to="/dashboard">Dashboard</Link> : <Link to="/login">Login</Link>}
      </nav>
      <Routes>
        <Route path="/" element={<h1>Welcome to EVE Report Generator</h1>} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard auth={auth} />} />
      </Routes>
    </div>
  );
}

export default App;

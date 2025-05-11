// frontend/src/pages/Login.js
import React from 'react';

function Login() {
  const handleLogin = () => {
    window.location.href = `${process.env.REACT_APP_API_BASE}/auth/eve/login`;
  };

  return (
    <div style={{ textAlign: 'center', marginTop: '2rem' }}>
      <h2>Login with EVE SSO</h2>
      <button onClick={handleLogin} style={{ padding: '0.5rem 1rem', fontSize: '1rem' }}>
        Login
      </button>
    </div>
  );
}

export default Login;

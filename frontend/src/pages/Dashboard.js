// frontend/src/pages/Dashboard.js
import React, { useEffect, useState } from 'react';
import axios from 'axios';

function Dashboard({ auth }) {
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (auth.isLoggedIn) {
      axios.get(`${process.env.REACT_APP_API_BASE}/api/user/profile`, { withCredentials: true })
        .then(res => setProfile(res.data))
        .catch(err => setError('Failed to load profile.'));
    }
  }, [auth]);

  if (!auth.isLoggedIn) return <p>Please log in first.</p>;
  if (error) return <p>{error}</p>;
  if (!profile) return <p>Loading profile...</p>;

  return (
    <div style={{ padding: '1rem' }}>
      <h2>Dashboard</h2>
      <p><strong>Character:</strong> {profile.characterName}</p>
      <p><strong>Corporation:</strong> {profile.corporationName}</p>
      <p><strong>Alliance:</strong> {profile.allianceName}</p>
      {/* Future: Links to kill activity, report generation, etc. */}
    </div>
  );
}

export default Dashboard;

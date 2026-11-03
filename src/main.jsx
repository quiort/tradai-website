import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import AdminPanel from './AdminPanel.jsx';
import { trackVisit } from './track.js';
import './styles.css';
import './pip/pip.css';
import './signal-demo.css';
import './download.css';
import './admin.css';

const isAdmin = () => location.hash === '#admin';

function Root() {
  const [admin, setAdmin] = useState(isAdmin);
  useEffect(() => {
    const onHash = () => setAdmin(isAdmin());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  useEffect(() => { if (!admin) trackVisit(); }, [admin]);
  return admin ? <AdminPanel /> : <App />;
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>
);

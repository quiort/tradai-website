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

// Admin lives at /admin (old #admin links still work).
const isAdmin = () => /^\/admin\/?$/.test(location.pathname) || location.hash === '#admin';

function Root() {
  const [admin, setAdmin] = useState(isAdmin);
  useEffect(() => {
    const onHash = () => setAdmin(isAdmin());
    if (location.hash === '#admin') history.replaceState(null, '', '/admin');
    window.addEventListener('hashchange', onHash);
    window.addEventListener('popstate', onHash);
    return () => { window.removeEventListener('hashchange', onHash); window.removeEventListener('popstate', onHash); };
  }, []);
  useEffect(() => { if (!admin) trackVisit(); }, [admin]);
  return admin ? <AdminPanel /> : <App />;
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>
);

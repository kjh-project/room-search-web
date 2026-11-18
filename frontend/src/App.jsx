import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext.jsx';
import MapPage from './pages/MapPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import OAuthCallback from './pages/OAuthCallback.jsx';
import MyPage from './pages/MyPage.jsx';
import { USE_MOCK } from './api/client.js';

function RequireLogin({ children }) {
  const { user, ready } = useAuth();
  if (!ready) return null;
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const { user, logout } = useAuth();
  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand">자취방 탐색기</Link>
        {USE_MOCK && <span className="badge">목업 모드</span>}
        <nav>
          {user ? (
            <>
              <Link to="/mypage">{user.nickname} 님</Link>
              <button className="link" onClick={logout}>로그아웃</button>
            </>
          ) : (
            <Link to="/login">로그인</Link>
          )}
        </nav>
      </header>
      <Routes>
        <Route path="/" element={<MapPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/oauth/:provider" element={<OAuthCallback />} />
        <Route path="/mypage" element={<RequireLogin><MyPage /></RequireLogin>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

import { Navigate, useNavigate } from 'react-router-dom';
import { USE_MOCK } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { authorizeUrl } from '../auth/oauth.js';

export default function LoginPage() {
  const { user, completeLogin } = useAuth();
  const navigate = useNavigate();
  if (user) return <Navigate to="/mypage" replace />;

  const go = async (provider) => {
    if (USE_MOCK) {
      await completeLogin(provider, 'mock-code', '');
      return navigate('/mypage');
    }
    window.location.href = authorizeUrl(provider);
  };

  return (
    <main className="login-page">
      <div className="card">
        <h1>자취방 탐색기</h1>
        <p className="muted">로그인하면 관심 매물을 저장하고 직접 매물을 등록할 수 있어요.</p>
        <button className="btn kakao" onClick={() => go('kakao')}>카카오로 시작하기</button>
        <button className="btn google" onClick={() => go('google')}>Google로 시작하기</button>
        <p className="footnote">
          로그인 시 서비스 이용에 필요한 최소 정보(제공자 회원번호, 닉네임)만 저장합니다.
        </p>
      </div>
    </main>
  );
}

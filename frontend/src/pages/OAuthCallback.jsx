/** SFR-001 2단계: 제공자가 돌려준 인가 코드를 서버로 전달 → JWT 수신 */
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { checkState, redirectUri } from '../auth/oauth.js';

export default function OAuthCallback() {
  const { provider } = useParams();
  const [params] = useSearchParams();
  const { completeLogin } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const sent = useRef(false); // StrictMode 이중 실행 방지 (인가 코드는 1회용)

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    const code = params.get('code');
    if (params.get('error')) return setError('로그인이 취소되었어요.');
    if (!code) return setError('인가 코드가 없어요.');
    if (!checkState(params.get('state'))) return setError('잘못된 로그인 요청이에요. 다시 시도해 주세요.');
    completeLogin(provider, code, redirectUri(provider))
      .then(() => navigate('/', { replace: true }))
      .catch((e) => setError(e.message));
  }, [provider, params, completeLogin, navigate]);

  return (
    <main className="login-page">
      <div className="card">
        {error ? (<><p className="error">{error}</p><Link to="/login">로그인 화면으로</Link></>) : <p>로그인 처리 중…</p>}
      </div>
    </main>
  );
}

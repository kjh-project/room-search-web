/**
 * SFR-001 OAuth 2.0 인가 코드 방식 — 1단계: 제공자 로그인 페이지로 이동
 * 제공자가 /oauth/:provider?code=...&state=... 로 돌려보내면 OAuthCallback 이 서버로 code 를 넘긴다.
 * 콘솔 등록 Redirect URI 예: http://localhost:5173/oauth/kakao , http://localhost:5173/oauth/google
 */
const STATE_KEY = 'jachui_oauth_state';

export const redirectUri = (provider) => `${window.location.origin}/oauth/${provider}`;

function newState() {
  const s = crypto.getRandomValues(new Uint32Array(4)).join('-');
  sessionStorage.setItem(STATE_KEY, s);
  return s;
}

/** CSRF 방지: 돌아온 state 가 보낸 값과 같은지 확인 (한 번 쓰면 삭제) */
export function checkState(returned) {
  const saved = sessionStorage.getItem(STATE_KEY);
  sessionStorage.removeItem(STATE_KEY);
  return !!saved && saved === returned;
}

export function authorizeUrl(provider) {
  const state = newState();
  if (provider === 'kakao') {
    const p = new URLSearchParams({
      client_id: import.meta.env.VITE_KAKAO_REST_KEY,
      redirect_uri: redirectUri('kakao'),
      response_type: 'code',
      state,
    });
    return `https://kauth.kakao.com/oauth/authorize?${p}`;
  }
  if (provider === 'google') {
    const p = new URLSearchParams({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri('google'),
      response_type: 'code',
      scope: 'openid profile', // 최소 정보만 (SIR-003)
      state,
      prompt: 'select_account',
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
  }
  throw new Error(`지원하지 않는 로그인 제공자: ${provider}`);
}

/** SFR-001 마이페이지: 관심 매물(찜) · 최근 조회 · 내가 등록한 매물 */
import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { getRecent } from '../lib/recent.js';

function ListingRows({ rows, empty, action }) {
  if (!rows) return <p className="muted">불러오는 중…</p>;
  if (!rows.length) return <p className="muted">{empty}</p>;
  return (
    <ul className="rows">
      {rows.map((l) => (
        <li key={l.listing_id}>
          <div>
            <strong>{l.title}</strong>
            <span className="muted">{l.room_type} · 보증금 {Number(l.deposit).toLocaleString()} / 월세 {l.rent}만원</span>
          </div>
          {action?.(l)}
        </li>
      ))}
    </ul>
  );
}

export default function MyPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState('fav');
  const [favs, setFavs] = useState(null);
  const [mine, setMine] = useState(null);
  const [error, setError] = useState(null);
  const recent = getRecent();

  useEffect(() => {
    api.getFavorites().then(setFavs).catch((e) => { setFavs([]); setError(e.message); });
    api.getMyListings().then(setMine).catch(() => setMine([])); // SFR-007 미완성이면 빈 목록
  }, []);

  const unfav = async (id) => {
    await api.removeFavorite(id);
    setFavs((f) => f.filter((x) => x.listing_id !== id));
  };

  return (
    <main className="mypage">
      <h1>{user.nickname} 님의 마이페이지</h1>
      <p className="muted">{user.provider === 'kakao' ? '카카오' : 'Google'} 계정으로 로그인</p>
      <div className="tabs">
        <button className={tab === 'fav' ? 'on' : ''} onClick={() => setTab('fav')}>관심 매물 {favs?.length ?? ''}</button>
        <button className={tab === 'recent' ? 'on' : ''} onClick={() => setTab('recent')}>최근 조회 {recent.length}</button>
        <button className={tab === 'mine' ? 'on' : ''} onClick={() => setTab('mine')}>내가 등록한 매물 {mine?.length ?? ''}</button>
      </div>
      {error && <p className="error">{error}</p>}
      {tab === 'fav' && (
        <ListingRows rows={favs} empty="찜한 매물이 없어요."
          action={(l) => <button className="btn small outline" onClick={() => unfav(l.listing_id)}>찜 해제</button>} />
      )}
      {tab === 'recent' && <ListingRows rows={recent} empty="최근 본 매물이 없어요." />}
      {tab === 'mine' && <ListingRows rows={mine} empty="등록한 매물이 없어요." />}
    </main>
  );
}

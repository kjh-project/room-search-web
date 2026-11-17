/**
 * 메인 지도 화면: 중심지 검색·반경·필터(SFR-002 UI) + 지도(SFR-003) + 매물 상세/시세(SFR-005)
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, USE_MOCK } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import KakaoMap from '../components/KakaoMap.jsx';
import LayerToggle from '../components/LayerToggle.jsx';
import PricePanel from '../components/PricePanel.jsx';
import { track } from '../lib/analytics.js';
import { formatDistance } from '../lib/geo.js';
import { searchInfraWithSdk, searchKeyword } from '../lib/kakao.js';
import { pushRecent } from '../lib/recent.js';

const RADII = [500, 1000, 2000, 3000];
const DEFAULT_CENTER = {
  lat: Number(import.meta.env.VITE_DEFAULT_LAT) || 35.1446,
  lng: Number(import.meta.env.VITE_DEFAULT_LNG) || 129.0343,
  name: '동의대학교',
};

async function fetchInfra(params) {
  try {
    return await api.getInfra(params);
  } catch (e) {
    if (USE_MOCK) throw e;
    // 서버 /api/infra 미구현·장애 시 브라우저 SDK 로 대체
    return searchInfraWithSdk(params);
  }
}

export default function MapPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [center, setCenter] = useState(DEFAULT_CENTER);
  const [radius, setRadius] = useState(1000);
  const [filters, setFilters] = useState({ maxRent: '', maxDeposit: '', roomType: '', sort: 'distance' });
  const [listings, setListings] = useState([]);
  const [infra, setInfra] = useState({ subway: [], convenience: [], mart: [] });
  const [layers, setLayers] = useState({ listing: true, subway: true, convenience: true, mart: true });
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [favIds, setFavIds] = useState(new Set());
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [msg, setMsg] = useState(null);
  const radiusRef = useRef(radius);
  radiusRef.current = radius;

  // 매물 조회 (중심·반경·필터 변경 시)
  useEffect(() => {
    let alive = true;
    api.getListings({ lat: center.lat, lng: center.lng, radius, ...filters })
      .then((rows) => alive && setListings(rows))
      .catch((e) => alive && setMsg(`매물 조회 실패: ${e.message}`));
    return () => { alive = false; };
  }, [center.lat, center.lng, radius, filters]);

  // 인프라 핀 조회 (중심·반경 변경 시)
  useEffect(() => {
    fetchInfra({ lat: center.lat, lng: center.lng, radius }).then(setInfra).catch(() => {});
  }, [center.lat, center.lng, radius]);

  // 찜 목록
  useEffect(() => {
    if (!user) return setFavIds(new Set());
    api.getFavorites().then((rows) => setFavIds(new Set(rows.map((r) => r.listing_id)))).catch(() => {});
  }, [user]);

  // 지도 이동이 끝나면(디바운스) 그 위치 기준으로 인프라 재조회
  const onMapIdle = useCallback((c) => {
    fetchInfra({ lat: c.lat, lng: c.lng, radius: radiusRef.current }).then(setInfra).catch(() => {});
  }, []);

  const onSelectListing = useCallback((l) => setSelectedId(l ? l.listing_id : null), []);
  const openDetail = useCallback((l) => {
    setSelectedId(l.listing_id);
    setDetail(l);
    pushRecent(l);
    track('view_listing', { listing_id: l.listing_id });
  }, []);

  const changeRadius = (r) => {
    setRadius(r);
    track('change_radius', { radius: r });
  };

  const doSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    try {
      const r = await searchKeyword(query.trim());
      setResults(r);
      if (!r.length) setMsg('검색 결과가 없어요.');
    } catch (err) {
      setMsg(err.message);
    }
  };

  const toggleFav = async (l) => {
    if (!user) return navigate('/login');
    const has = favIds.has(l.listing_id);
    const next = new Set(favIds);
    has ? next.delete(l.listing_id) : next.add(l.listing_id);
    setFavIds(next); // 낙관적 업데이트
    try {
      has ? await api.removeFavorite(l.listing_id) : await api.addFavorite(l.listing_id);
      if (!has) track('add_favorite', { listing_id: l.listing_id });
    } catch (e) {
      setFavIds(favIds); // 실패 시 되돌림
      setMsg(`찜 처리 실패: ${e.message}`);
    }
  };

  const counts = useMemo(() => ({
    listing: listings.length,
    subway: infra.subway?.length ?? 0,
    convenience: infra.convenience?.length ?? 0,
    mart: infra.mart?.length ?? 0,
  }), [listings, infra]);

  const nearest = (key) => infra[key]?.[0];

  return (
    <main className="map-page">
      <aside className="sidebar">
        <form className="search" onSubmit={doSearch}>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="학교·직장·역 이름으로 중심지 검색" />
          <button className="btn">검색</button>
        </form>
        {results.length > 0 && (
          <ul className="search-results">
            {results.map((r) => (
              <li key={`${r.lat},${r.lng}`}>
                <button onClick={() => { setCenter(r); setResults([]); setQuery(r.name); setDetail(null); }}>
                  <strong>{r.name}</strong><span className="muted">{r.address}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="center-label">📍 중심지: <strong>{center.name}</strong></div>

        <div className="seg radius">
          {RADII.map((r) => (
            <button key={r} className={radius === r ? 'on' : ''} onClick={() => changeRadius(r)}>
              {r >= 3000 ? '3km 이상' : formatDistance(r)}
            </button>
          ))}
        </div>

        <div className="filters">
          <label>월세 최대
            <input type="number" min="0" placeholder="만원" value={filters.maxRent}
              onChange={(e) => setFilters({ ...filters, maxRent: e.target.value })} />
          </label>
          <label>보증금 최대
            <input type="number" min="0" placeholder="만원" value={filters.maxDeposit}
              onChange={(e) => setFilters({ ...filters, maxDeposit: e.target.value })} />
          </label>
          <label>방 유형
            <select value={filters.roomType} onChange={(e) => setFilters({ ...filters, roomType: e.target.value })}>
              <option value="">전체</option><option>원룸</option><option>투룸</option><option>오피스텔</option>
            </select>
          </label>
          <label>정렬
            <select value={filters.sort} onChange={(e) => setFilters({ ...filters, sort: e.target.value })}>
              <option value="distance">거리순</option><option value="price">가격순</option>
            </select>
          </label>
        </div>

        {msg && <p className="error" onClick={() => setMsg(null)}>{msg}</p>}

        {detail ? (
          <div className="detail">
            <button className="link" onClick={() => setDetail(null)}>← 목록으로</button>
            <h2>{detail.title}</h2>
            <p className="muted">{detail.address}</p>
            <div className="kv">
              <span>보증금/월세</span><strong>{detail.deposit.toLocaleString()} / {detail.rent}만원</strong>
              <span>유형·면적</span><strong>{detail.room_type} · {detail.area}㎡</strong>
              {detail.distance_m != null && (<><span>중심지까지</span><strong>{formatDistance(detail.distance_m)}</strong></>)}
            </div>
            <button className={`btn ${favIds.has(detail.listing_id) ? 'outline' : ''}`} onClick={() => toggleFav(detail)}>
              {favIds.has(detail.listing_id) ? '♥ 찜 해제' : '♡ 찜하기'}
            </button>

            <section className="infra-summary">
              <h3>주변 생활 인프라 <span className="muted">(반경 {formatDistance(radius)})</span></h3>
              <ul>
                <li>🚇 지하철역 {counts.subway}곳 {nearest('subway') && `· 가장 가까운 곳 ${nearest('subway').name}`}</li>
                <li>🏪 편의점 {counts.convenience}곳</li>
                <li>🛒 대형마트 {counts.mart}곳 {nearest('mart') && `· ${nearest('mart').name}`}</li>
              </ul>
            </section>

            <PricePanel listing={detail} />

            {/* SFR-004 AI 코멘트(종환 님) 컴포넌트가 들어올 자리 */}
            <div id="ai-comment-slot" />
          </div>
        ) : (
          <ul className="listing-list">
            {listings.length === 0 && <li className="muted">조건에 맞는 매물이 없어요.</li>}
            {listings.map((l) => (
              <li key={l.listing_id} className={selectedId === l.listing_id ? 'sel' : ''}>
                <button onClick={() => openDetail(l)}>
                  <strong>{l.deposit.toLocaleString()}/{l.rent}</strong> <span>{l.title}</span>
                  <span className="muted">{l.room_type} · {l.area}㎡ · {formatDistance(l.distance_m)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      <section className="map-area">
        <LayerToggle layers={layers} counts={counts} onChange={setLayers} />
        <KakaoMap
          center={center}
          radius={radius}
          listings={listings}
          infra={infra}
          layers={layers}
          selectedId={selectedId}
          onSelectListing={onSelectListing}
          onOpenDetail={openDetail}
          onMapIdle={onMapIdle}
        />
      </section>
    </main>
  );
}

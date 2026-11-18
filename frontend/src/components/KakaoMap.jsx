/**
 * SFR-003 카카오맵 SDK 연동 및 인프라 핀 표시
 *  - 가격 라벨 커스텀 마커 + 인포윈도우(보증금·월세, 면적, 상세 보기)
 *  - 중심지 마커 + 반경 원(Circle)
 *  - 지하철역·편의점·대형마트 아이콘 핀, 레이어 토글(layers prop)
 *  - 지도 이동이 끝나면(idle) 디바운스 후 onMapIdle 호출 → 부모가 인프라 재조회
 *
 * 오버레이 내용은 innerHTML 대신 DOM 으로 만들어 XSS 를 막는다 (SIR-002).
 */
import { useEffect, useRef, useState } from 'react';
import { loadKakao } from '../lib/kakao.js';
import { debounce, formatDistance } from '../lib/geo.js';

const INFRA_STYLE = {
  subway: { icon: '🚇', label: '지하철역', cls: 'pin-subway' },
  convenience: { icon: '🏪', label: '편의점', cls: 'pin-conv' },
  mart: { icon: '🛒', label: '대형마트', cls: 'pin-mart' },
};

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

export default function KakaoMap({
  center, radius, listings, infra, layers, selectedId, onSelectListing, onOpenDetail, onMapIdle,
}) {
  const boxRef = useRef(null);
  const mapRef = useRef(null);
  const kakaoRef = useRef(null);
  const centerObjs = useRef({ marker: null, circle: null });
  const listingOverlays = useRef([]);
  const infoOverlay = useRef(null);
  const infraOverlays = useRef({ subway: [], convenience: [], mart: [] });
  const idleCb = useRef(onMapIdle);
  idleCb.current = onMapIdle;
  const [error, setError] = useState(null);
  const [ready, setReady] = useState(false);

  // 1) 지도 생성 (한 번)
  useEffect(() => {
    let cancelled = false;
    loadKakao()
      .then((kakao) => {
        if (cancelled || mapRef.current) return;
        kakaoRef.current = kakao;
        const map = new kakao.maps.Map(boxRef.current, {
          center: new kakao.maps.LatLng(center.lat, center.lng),
          level: 5,
        });
        map.addControl(new kakao.maps.ZoomControl(), kakao.maps.ControlPosition.RIGHT);
        const onIdle = debounce(() => {
          const c = map.getCenter();
          idleCb.current?.({ lat: c.getLat(), lng: c.getLng() });
        }, 500);
        kakao.maps.event.addListener(map, 'idle', onIdle);
        mapRef.current = map;
        setReady(true);
      })
      .catch((e) => !cancelled && setError(e.message));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2) 중심 마커 + 반경 원
  useEffect(() => {
    if (!ready) return;
    const kakao = kakaoRef.current;
    const map = mapRef.current;
    const pos = new kakao.maps.LatLng(center.lat, center.lng);
    const { marker, circle } = centerObjs.current;
    if (marker) marker.setMap(null);
    if (circle) circle.setMap(null);
    centerObjs.current.marker = new kakao.maps.Marker({ position: pos, map, title: '검색 중심지' });
    centerObjs.current.circle = new kakao.maps.Circle({
      center: pos, radius, map,
      strokeWeight: 2, strokeColor: '#3b6ef5', strokeOpacity: 0.8, strokeStyle: 'dashed',
      fillColor: '#3b6ef5', fillOpacity: 0.07,
    });
    map.panTo(pos);
    // 반경에 맞게 줌 레벨 조정
    const level = radius <= 500 ? 4 : radius <= 1000 ? 5 : radius <= 2000 ? 6 : 7;
    map.setLevel(level, { anchor: pos });
  }, [ready, center.lat, center.lng, radius]);

  // 3) 매물 가격 라벨 핀
  useEffect(() => {
    if (!ready) return;
    const kakao = kakaoRef.current;
    listingOverlays.current.forEach((o) => o.setMap(null));
    listingOverlays.current = listings.map((l) => {
      const btn = el('button', `price-pin${l.listing_id === selectedId ? ' selected' : ''}`, `${l.deposit}/${l.rent}`);
      btn.title = l.title;
      btn.onclick = () => onSelectListing?.(l);
      return new kakao.maps.CustomOverlay({
        position: new kakao.maps.LatLng(l.lat, l.lng),
        content: btn,
        yAnchor: 1.3,
        zIndex: l.listing_id === selectedId ? 5 : 3,
        map: layers.listing ? mapRef.current : null,
      });
    });
  }, [ready, listings, selectedId, layers.listing, onSelectListing]);

  // 4) 선택 매물 인포윈도우
  useEffect(() => {
    if (!ready) return;
    const kakao = kakaoRef.current;
    infoOverlay.current?.setMap(null);
    infoOverlay.current = null;
    const l = listings.find((x) => x.listing_id === selectedId);
    if (!l || !layers.listing) return;
    const box = el('div', 'info-window');
    box.append(
      el('strong', null, l.title),
      el('div', null, `보증금 ${l.deposit.toLocaleString()} / 월세 ${l.rent}만원`),
      el('div', 'muted', `${l.room_type} · ${l.area}㎡${l.distance_m != null ? ` · 중심지에서 ${formatDistance(l.distance_m)}` : ''}`)
    );
    const detail = el('button', 'btn small', '상세 보기');
    detail.onclick = () => onOpenDetail?.(l);
    const close = el('button', 'info-close', '×');
    close.setAttribute('aria-label', '닫기');
    close.onclick = () => onSelectListing?.(null);
    box.append(detail, close);
    infoOverlay.current = new kakao.maps.CustomOverlay({
      position: new kakao.maps.LatLng(l.lat, l.lng),
      content: box, yAnchor: 1.55, zIndex: 10, map: mapRef.current,
    });
  }, [ready, listings, selectedId, layers.listing, onSelectListing, onOpenDetail]);

  // 5) 인프라 핀 (지하철·편의점·마트)
  useEffect(() => {
    if (!ready) return;
    const kakao = kakaoRef.current;
    for (const key of Object.keys(INFRA_STYLE)) {
      infraOverlays.current[key].forEach((o) => o.setMap(null));
      const st = INFRA_STYLE[key];
      infraOverlays.current[key] = (infra?.[key] || []).map((p) => {
        const pin = el('div', `infra-pin ${st.cls}`, st.icon);
        pin.title = `${p.name} (${formatDistance(p.distance_m)})`;
        return new kakao.maps.CustomOverlay({
          position: new kakao.maps.LatLng(p.lat, p.lng),
          content: pin, zIndex: 2,
          map: layers[key] ? mapRef.current : null,
        });
      });
    }
  }, [ready, infra, layers.subway, layers.convenience, layers.mart]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="map-wrap">
      <div ref={boxRef} className="map" />
      {error && (
        <div className="map-error">
          <strong>지도를 불러오지 못했어요</strong>
          <p>{error}</p>
        </div>
      )}
    </div>
  );
}

export { INFRA_STYLE };

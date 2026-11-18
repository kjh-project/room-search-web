/**
 * GA4 이벤트 전송 도우미. gtag.js 삽입(SFR-006)은 종환 님 담당이므로,
 * gtag 가 아직 없으면 아무것도 하지 않는다. 개인정보는 넣지 않는다 (SIR-003).
 */
export function track(eventName, params = {}) {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag('event', eventName, params);
  }
}

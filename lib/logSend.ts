import type { EventPayload } from "./logEvent";

/**
 * 익명 로그 전송 — 브라우저에서만 부른다
 *
 * **보내고 잊는다.** 응답을 기다리지 않고, 실패해도 알리지 않는다.
 * 로그가 화면을 붙잡는 순간 이 기능은 순손실이 된다 —
 * 대기실 와이파이는 느리고, 환자가 보는 것은 타임라인이지 로그가 아니다.
 *
 * sendBeacon 을 먼저 쓴다. 화면을 떠나는 중에도 전송이 살아남고,
 * 브라우저가 유휴 시간에 알아서 보내므로 렌더링을 방해하지 않는다.
 * 없는 브라우저(구형 Android WebView 등)에서는 keepalive fetch 로 간다.
 *
 * 주소도 조각도 보내지 않는다. 보내는 것은 EventPayload 뿐이다.
 */
const ENDPOINT = "/api/log";

export function sendEvent(payload: EventPayload): void {
  if (typeof navigator === "undefined") return;

  try {
    const body = JSON.stringify(payload);

    if (typeof navigator.sendBeacon === "function") {
      const blob = new Blob([body], { type: "application/json" });
      // 큐에 넣지 못했을 때만(대기 중인 beacon 이 한도를 넘긴 경우) 아래로
      if (navigator.sendBeacon(ENDPOINT, blob)) return;
    }

    void fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {
      // 오프라인. 조용히 버린다
    });
  } catch {
    // 직렬화 실패든 차단이든 여기서 끝낸다. 화면은 이 함수를 모른다
  }
}

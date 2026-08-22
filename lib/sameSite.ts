/**
 * 다른 사이트가 대신 보낸 요청인가 — /api/log 앞의 문
 *
 * `/api/log` 는 인증이 없는 열린 엔드포인트다. 형태 검증(lib/logEvent.ts)은
 * **모양이 틀린 것**을 막지만, 모양이 맞는 가짜는 막지 못한다. 아무 웹페이지나
 * 방문자 몰래 `fetch("https://…/api/log", {method:"POST"})` 를 부를 수 있고,
 * 그러면 4주 실증의 도달 수·배지 분포가 조용히 오염된다. **없는 데이터보다
 * 나쁜 것은 틀린 데이터다** — 그 숫자로 QI 발표를 한다.
 *
 * 그래서 브라우저가 스스로 붙이는 `Sec-Fetch-Site` 를 본다. 페이지 코드가
 * 만들 수 없는 헤더라 위조되지 않는다(fetch 로 지정하면 브라우저가 무시한다).
 *
 * **없으면 막지 않는다.** 아주 오래된 안드로이드 WebView 는 이 헤더를 붙이지
 * 않는데, 거기서 로그가 빠지는 것보다 조용히 통과시키는 편이 낫다. 로그는
 * 부가 기능이고, 이 문은 "정상 사용을 막지 않는 선에서 걸러 낸다" 가 전부다.
 *
 * curl 은 이 문을 그냥 지나간다. 그쪽은 lib/rateLimit.ts 가 상대한다 —
 * 헤더 한 줄로 막을 수 있는 상대가 아니고, 막으려 들면 정상 브라우저를
 * 먼저 잡는다.
 *
 * **개인을 가리키는 헤더는 읽지 않는다.** IP 도 User-Agent 도 여기서
 * 열지 않는다 (app/api/log/route.ts 의 원칙).
 */

/** 브라우저가 "다른 사이트에서 왔다"고 스스로 밝힌 경우에만 true */
export function isCrossSiteRequest(headers: Headers): boolean {
  const site = headers.get("sec-fetch-site");
  if (site === null) return false;

  // same-origin: 이 서비스 화면에서 보낸 것
  // same-site:   같은 도메인의 다른 호스트(www 등). 나중에 생겨도 안 막는다
  // none:        주소창 직접 입력 등. 페이지가 대신 보낸 것이 아니다
  return site !== "same-origin" && site !== "same-site" && site !== "none";
}

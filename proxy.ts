import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { isMaintenance } from "@/lib/serviceStatus";

/**
 * kill switch — PRD §18 R5
 *
 * 여기가 kill switch의 진짜 자리다.
 *
 * layout.tsx 에서 children 을 렌더링하지 않는 것만으로는 부족하다.
 * Next.js는 레이아웃이 children 을 화면에 넣지 않아도 페이지 세그먼트를
 * 실행해 RSC 페이로드에 담아 보낸다. 즉 계산 로직이 그대로 돌고
 * 계산 결과가 HTML에 실려 나간다.
 *
 * proxy 는 라우팅·렌더링보다 먼저 실행되므로,
 * 여기서 막아야 페이지 코드가 아예 실행되지 않는다.
 *
 * **이 파일의 이름이 proxy.ts 인 이유.** Next 16 에서 `middleware` 파일
 * 규약이 deprecated 되고 `proxy` 로 이름이 바뀌었다. 하는 일은 같다.
 * 옛 이름으로 두면 언젠가 지원이 끊기면서 **kill switch 와 CSP 가 동시에
 * 사라지는데**, 둘 다 없어져도 화면은 멀쩡히 뜬다. 즉 밖에서는 아무 증상이
 * 없다. 그런 종류의 실패는 이름을 미리 옮겨 두는 것으로만 막을 수 있다.
 *
 * ─────────────────────────────────────────────────────────────
 *
 * **CSP 도 여기서 붙인다.**
 *
 * nonce 는 요청마다 새로 만들어야 하므로 next.config 의 정적 헤더로는
 * 만들 수 없다. Next 는 들어오는 요청의 Content-Security-Policy 헤더에서
 * `nonce-...` 를 읽어 자기가 넣는 script 태그에 자동으로 달아 준다.
 *
 * 이 서비스에 인라인 스크립트를 넣는 곳은 Next 자신뿐이고(외부 스크립트
 * 0개 · 웹폰트 0개 · 이미지 0개), 자유 텍스트 입력이 없어 HTML 주입
 * 경로도 없다. 그래서 script-src 를 끝까지 좁힐 수 있다.
 *
 * 여기서 진짜로 막는 것 두 가지:
 *
 *   frame-ancestors 'none' — **다른 사이트가 이 화면을 iframe 으로
 *   품는 것.** 병원 공식 안내처럼 꾸민 페이지 안에 이 카드를 끼워 넣으면
 *   §11 Disclaimer 가 있어도 환자는 그 페이지를 공식으로 읽는다.
 *   PRD §18 R5(공식 안내로 오인) 가 실제로 벌어지는 경로다.
 *
 *   connect-src 'self' — 답이 바깥으로 나가는 길. 의존성이 언젠가
 *   오염되더라도 브라우저가 외부 전송 자체를 거부한다.
 */

/** 요청 하나에 하나. 예측 가능하면 nonce 가 아니다 */
function makeNonce(): string {
  return crypto.randomUUID().replaceAll("-", "");
}

function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV === "development";

  return [
    "default-src 'self'",
    // dev 에서 React 는 서버 에러 스택을 브라우저에서 재구성하느라 eval 을 쓴다.
    // 프로덕션 빌드에는 필요 없다
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // 스타일은 nonce 를 쓰지 않는다. 하나라도 새면 접수 창구에서 스타일이
    // 깨진 화면이 뜨는데, 인라인 스타일로는 이 앱에 스크립트가 들어올 길이
    // 없다 (주입 지점이 없다). 깨지는 쪽이 더 나쁜 실패다
    "style-src 'self' 'unsafe-inline'",
    // 이미지는 쓰지 않는다. blob: 은 캘린더 파일(.ics)을 기기에서 만들 때 쓴다
    "img-src 'self' data:",
    "font-src 'self'",
    // 익명 로그(/api/log)는 같은 오리진이다. 밖으로 나가는 연결은 없다
    isDev ? "connect-src 'self' ws: wss:" : "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    // dev 에서만 연다. PC 폰 미리보기가 iframe 세 개로 이 화면을 띄운다 —
    // 배포본에서 열어 두면 남의 페이지가 이 카드를 품을 수 있다
    isDev ? "frame-ancestors 'self' http://localhost:* file:" : "frame-ancestors 'none'",
    "frame-src 'none'",
    // dev 는 사설 IP 에 http 로 붙는다(폰 확인). 여기서 켜면 자산이 https 로
    // 올라가 버려 폰에서 화면이 비는데, 배포본은 어차피 전부 https 다
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export function proxy(request: NextRequest) {
  const nonce = makeNonce();
  const csp = buildCsp(nonce);

  // Next 가 nonce 를 읽는 곳은 **요청 헤더**다. 응답에만 넣으면 헤더는
  // 붙는데 script 태그에 nonce 가 없어 화면이 통째로 죽는다
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("content-security-policy", csp);

  const response = maintenanceRewrite(request, requestHeaders);
  response.headers.set("content-security-policy", csp);
  return response;
}

function maintenanceRewrite(
  request: NextRequest,
  requestHeaders: Headers,
): NextResponse {
  const passthrough = NextResponse.next({ request: { headers: requestHeaders } });

  if (!isMaintenance()) return passthrough;
  if (request.nextUrl.pathname === "/maintenance") return passthrough;

  const url = request.nextUrl.clone();
  url.pathname = "/maintenance";
  url.search = "";

  // rewrite: 주소창의 QR 링크는 그대로 두고 내용만 바꾼다.
  // redirect를 쓰면 환자가 잘못된 링크를 받았다고 오해한다.
  return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
}

export const config = {
  // /api/log 도 포함한다 — kill switch 는 로그 적재보다 먼저다
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

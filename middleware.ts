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
 * 미들웨어는 라우팅·렌더링보다 먼저 실행되므로,
 * 여기서 막아야 페이지 코드가 아예 실행되지 않는다.
 */
export function middleware(request: NextRequest) {
  if (!isMaintenance()) {
    return NextResponse.next();
  }

  if (request.nextUrl.pathname === "/maintenance") {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = "/maintenance";
  url.search = "";

  // rewrite: 주소창의 QR 링크는 그대로 두고 내용만 바꾼다.
  // redirect를 쓰면 환자가 잘못된 링크를 받았다고 오해한다.
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

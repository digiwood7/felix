import type { Metadata, Viewport } from "next";

import Disclaimer from "@/components/Disclaimer";
import Maintenance from "@/components/Maintenance";
import { isMaintenance } from "@/lib/serviceStatus";

import "./globals.css";

export const metadata: Metadata = {
  title: "핵의학과 PET 검사 준비 안내",
  description: "예약 시간에 맞춘 검사 준비 일정을 확인합니다.",
  // 병원 브랜드를 서비스 아이덴티티로 쓰지 않는다 (PRD §6.5)
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // 확대를 막지 않는다. 고령 사용자가 핀치 줌으로 키울 수 있어야 한다.
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // kill switch 2차 방어선.
  // 실제 차단은 middleware.ts 에서 한다 — 미들웨어가 라우팅보다 먼저 실행되어야
  // 페이지 코드가 아예 실행되지 않기 때문이다.
  // 여기서는 미들웨어가 우회되는 경우에도 화면에 아무것도 새지 않도록 한 번 더 막는다.
  if (isMaintenance()) {
    return (
      <html lang="ko">
        <body>
          <Maintenance />
          {/* 점검 화면도 화면이다 — PRD §11 은 예외를 두지 않는다 */}
          <Disclaimer />
        </body>
      </html>
    );
  }

  return (
    <html lang="ko">
      <body>
        {children}
        {/* PRD §11 — 모든 화면 하단 고정. 개별 화면에서 넣지 않는다. */}
        <Disclaimer />
      </body>
    </html>
  );
}

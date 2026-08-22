import os from "node:os";

import type { NextConfig } from "next";

/**
 * 개발 중 실기기(폰) 확인을 위한 설정.
 *
 * Next 16 dev 서버는 다른 오리진에서 오는 /_next/* 요청을 기본으로 막는다.
 * 폰에서 LAN IP(예: 192.168.0.10:3000)로 접속하면 HTML은 오는데
 * CSS·JS가 차단되어 **스타일 없는 텍스트만** 보인다.
 *
 * 공유기가 IP를 다시 할당할 때마다 값을 고쳐 넣지 않도록,
 * 현재 기기의 사설 IPv4 주소를 dev 시작 시점에 읽어서 넣는다.
 *
 * dev 전용 설정이다. 배포본은 실제 도메인에서 같은 오리진으로 서빙되므로
 * 영향을 받지 않는다.
 */
function localNetworkAddresses(): string[] {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((iface) => iface && iface.family === "IPv4" && !iface.internal)
    .map((iface) => iface!.address);
}

/**
 * 같은 Wi-Fi 가 아닌 사람에게 보여줄 때는 LAN IP 로 안 된다.
 * `cloudflared tunnel --url http://localhost:3000` 으로 임시 공개 주소를 만드는데,
 * 그때 오는 요청의 호스트가 `*.trycloudflare.com` 이라 여기에 넣어둬야
 * 위와 같은 이유로 CSS·JS 가 막히지 않는다.
 */
const TUNNEL_HOSTS = ["*.trycloudflare.com"];

/**
 * 요청과 무관하게 언제나 같은 보안 헤더.
 *
 * 요청마다 값이 달라지는 CSP 는 여기에 둘 수 없다 — nonce 가 매번 새로
 * 만들어져야 하므로 proxy.ts 가 붙인다. 나머지는 정적이고,
 * 여기 두면 proxy 를 타지 않는 정적 자산에도 함께 붙는다.
 */
const isDev = process.env.NODE_ENV === "development";

const SECURITY_HEADERS = [
  /**
   * frame-ancestors 의 옛 형제. CSP 를 모르는 오래된 브라우저용이다.
   *
   * dev 에서는 빼 둔다 — PC 폰 미리보기가 iframe 으로 화면을 띄운다.
   * 값에 오리진 목록을 적을 수 없는 옛 헤더라(ALLOW-FROM 은 폐기됐다)
   * 켜고 끄는 수밖에 없고, 진짜 방어는 CSP frame-ancestors 가 한다.
   */
  ...(isDev ? [] : [{ key: "X-Frame-Options", value: "DENY" }]),
  { key: "X-Content-Type-Options", value: "nosniff" },
  /**
   * 주소를 밖으로 흘리지 않는다.
   *
   * `?t=202608201425` 에는 예약 일시가 들어 있다. 개인을 특정하는 값은
   * 아니지만(PRD §14), 밖으로 내보낼 이유도 없다. 이 서비스에는 외부
   * 링크가 하나도 없으므로 no-referrer 로 깎아도 깨지는 것이 없다.
   */
  { key: "Referrer-Policy", value: "no-referrer" },
  /**
   * 쓰지 않는 기기 권한을 문 닫아 둔다. 이 서비스가 쓰는 것은
   * 화면 낭독(speechSynthesis)뿐이고 그건 권한이 필요 없다.
   */
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), display-capture=(), interest-cohort=()",
  },
  // https 로만 붙는다. QR 로 들어오는 첫 요청이 http 로 새는 것을 막는다
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  // 다른 창이 window.opener 로 이 화면을 만지지 못하게 한다
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  /**
   * 색인 금지 — layout.tsx 의 robots 메타와 같은 말을 헤더로도 한다.
   * 메타는 HTML 을 파싱해야 보이고, .ics 같은 비HTML 응답에는 없다.
   * 도달 경로를 QR 하나로 좁혀 두는 것이 이 서비스의 안전장치다 (§15).
   */
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
];

const nextConfig: NextConfig = {
  // v1은 서버 상태를 갖지 않는다. 이미지 최적화·리라이트 등 추가 설정 없음.
  allowedDevOrigins: [...localNetworkAddresses(), ...TUNNEL_HOSTS],

  // 프레임워크와 버전을 광고하지 않는다. 알려서 얻을 것이 없다
  poweredByHeader: false,

  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;

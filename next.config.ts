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

const nextConfig: NextConfig = {
  // v1은 서버 상태를 갖지 않는다. 이미지 최적화·리라이트 등 추가 설정 없음.
  allowedDevOrigins: localNetworkAddresses(),
};

export default nextConfig;

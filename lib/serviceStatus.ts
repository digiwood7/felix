/**
 * kill switch — PRD §18 R5 대응
 *
 * 시각 계산 오류가 실환자에게 1건이라도 발생하면 즉시 서비스를 멈춰야 한다.
 * 스티커는 이미 벽에 붙어 있으므로 페이지를 내리면 QR이 404가 될 뿐이다.
 * 대신 전 화면을 안내 문구로 바꾼다.
 *
 * 이 판정은 계산 로직보다 먼저 평가되어야 한다 (CLAUDE.md 아키텍처 규칙).
 */

export type ServiceStatus = "live" | "maintenance";

/**
 * 환경변수 값 → 서비스 상태.
 *
 * 알 수 없는 값은 "live"로 본다. 오타 때문에 서비스가 멈추면 안 되고,
 * 멈추는 쪽은 사람이 명시적으로 의도했을 때만 일어나야 한다.
 */
export function resolveServiceStatus(raw: string | undefined): ServiceStatus {
  return raw?.trim().toLowerCase() === "maintenance" ? "maintenance" : "live";
}

export function getServiceStatus(): ServiceStatus {
  return resolveServiceStatus(process.env.NEXT_PUBLIC_SERVICE_STATUS);
}

export function isMaintenance(): boolean {
  return getServiceStatus() === "maintenance";
}

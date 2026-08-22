import Maintenance from "@/components/Maintenance";

/**
 * kill switch가 켜졌을 때 미들웨어가 모든 요청을 이 경로로 rewrite 한다.
 * 직접 접근할 일은 없다.
 */

/**
 * 요청마다 렌더링한다 — CSP nonce 때문이다.
 *
 * 빌드 시점에 굳혀 두면 그 HTML 의 script 태그에는 nonce 가 없고,
 * middleware.ts 가 붙인 CSP 가 그것을 막는다. 하필 **kill switch 를 켠
 * 상황에서** 스크립트가 죽은 화면이 뜨는 셈이라, 여기만은 굳히지 않는다.
 */
export const dynamic = "force-dynamic";
export default function MaintenancePage() {
  return <Maintenance />;
}

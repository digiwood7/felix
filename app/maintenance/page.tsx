import Maintenance from "@/components/Maintenance";

/**
 * kill switch가 켜졌을 때 미들웨어가 모든 요청을 이 경로로 rewrite 한다.
 * 직접 접근할 일은 없다.
 */
export default function MaintenancePage() {
  return <Maintenance />;
}

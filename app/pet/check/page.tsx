/**
 * S3 — 상태 문답 (PRD §8 F2)
 *
 * 구현: T6 (잠정 문항) → T8 (tally·직원 피드백 반영으로 확정)
 * 자유 텍스트 입력 필드를 만들지 않는다. 선택지는 룰셋에서 읽는다.
 */
export default function CheckScreen() {
  return (
    <main className="flex-1 px-5 py-8">
      <h1 className="text-2xl font-bold">준비 상태 확인</h1>

      <p className="mt-8 text-base text-slate-500">
        S3 문답 화면 — T6에서 구현합니다.
      </p>
    </main>
  );
}

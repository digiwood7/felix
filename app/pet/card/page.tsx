/**
 * S4 — 요약카드 + 배지 (PRD §8 F2)
 *
 * 구현: T7
 * 이 제품의 핵심 산출물. 직원이 3초 안에 스캔할 수 있어야 한다.
 * 배지 판정은 룰셋 flags + triage 로만 한다 (PRD §9.4).
 */
export default function CardScreen() {
  return (
    <main className="flex-1 px-5 py-8">
      <h1 className="text-2xl font-bold">접수처에 보여주는 화면</h1>

      <p className="mt-8 text-base text-slate-500">
        S4 요약카드 — T7에서 구현합니다.
      </p>
    </main>
  );
}

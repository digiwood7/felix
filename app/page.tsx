/**
 * S1 — 날짜·시각 입력 (PRD §10)
 *
 * 구현: T5
 * 이 화면에는 이름·등록번호·연락처·생년월일 입력 필드를 넣지 않는다.
 */
export default function InputScreen() {
  return (
    <main className="flex-1 px-5 py-8">
      <h1 className="text-2xl font-bold">검사 준비 안내</h1>
      <p className="mt-3 text-lg text-slate-700">
        예약하신 날짜와 시각을 입력하면 준비 일정을 알려드립니다.
      </p>

      <p className="mt-8 text-base text-slate-500">
        S1 입력 화면 — T5에서 구현합니다.
      </p>
    </main>
  );
}

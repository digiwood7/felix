/**
 * kill switch가 켜졌을 때 모든 라우트를 대체하는 화면 — PRD §18 R5
 *
 * 계산 결과를 일절 보여주지 않는다. 환자를 사람에게 보내는 것이 목적이다.
 */
export default function Maintenance() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-2xl font-bold text-slate-900">
        지금은 안내를 제공하지 않습니다
      </h1>

      <p className="text-lg leading-relaxed text-slate-700">
        검사 준비사항은 접수처 또는 아래 번호로 문의해 주세요.
      </p>

      <a
        href="tel:1599-3114"
        className="rounded-xl bg-slate-900 px-8 py-4 text-xl font-bold text-white"
      >
        1599-3114
      </a>
    </main>
  );
}

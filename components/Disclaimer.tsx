/**
 * PRD §11 필수 표기 — 모든 화면 하단에 고정된다.
 *
 * layout.tsx 에서 렌더링하므로 개별 화면에서 따로 넣지 않는다.
 * 화면마다 넣으면 언젠가 하나를 빠뜨리고, 공유 링크로 들어온 사람에게는
 * S2나 S4가 첫 화면이 된다.
 *
 * 문구를 수정하지 말 것. 이 문장은 환자를 위한 것이자
 * 관리자 승인 자료의 핵심 슬라이드다 (PRD §11).
 */
export default function Disclaimer() {
  return (
    <footer className="mt-auto border-t border-slate-200 px-5 py-4">
      <p className="text-[0.8235rem] leading-relaxed text-slate-600">
        이 서비스는 병원 공식 서비스가 아니며, 검사 가능 여부를 판단하지
        않습니다. 최종 확인은 반드시 핵의학과 직원에게 받으세요.
      </p>
    </footer>
  );
}

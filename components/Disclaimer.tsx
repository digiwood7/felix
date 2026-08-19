import { DISCLAIMER } from "@/lib/disclaimer";

/**
 * PRD §11 필수 표기 — 모든 화면 하단에 고정된다.
 *
 * layout.tsx 에서 렌더링하므로 개별 화면에서 따로 넣지 않는다.
 * 화면마다 넣으면 언젠가 하나를 빠뜨리고, 공유 링크로 들어온 사람에게는
 * S2나 S4가 첫 화면이 된다.
 *
 * 문구는 lib/disclaimer.ts 에 있다. 캘린더 파일에도 같은 문장이 붙으므로
 * 여기에 적어 두면 두 벌이 된다.
 */
export default function Disclaimer() {
  return (
    // 1rem = 17px. PRD §13 본문 최소치를 지킨다.
    // 각주처럼 작게 줄이면 고령 사용자에게는 없는 것과 같고,
    // 이 두 문장은 관리자 승인 자료의 핵심이기도 하다 (PRD §11).
    <footer className="mt-auto border-t border-slate-200 px-5 py-4">
      <p className="text-[1rem] leading-snug text-slate-600">{DISCLAIMER}</p>
    </footer>
  );
}

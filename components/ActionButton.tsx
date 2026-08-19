"use client";

/**
 * 전달 기능 버튼 — 읽어주기 · 알림 · 보내기가 같은 모양이라야 한 줄로 읽힌다.
 *
 * 아이콘만 두지 않는다. 기호의 뜻은 사람마다 다르게 읽히고 스크린리더가
 * 읽지 못한다 (WCAG 1.1.1, PRD §13). **뜻은 글자가 담고 아이콘은 거든다.**
 *
 * 터치 영역은 60px — PRD §13 최소치 48px 위다.
 */
export default function ActionButton({
  onClick,
  label,
  children,
  active = false,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
  /** 지금 동작 중(읽는 중 등). 색과 글자 둘 다로 알린다 */
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[60px] flex-1 flex-col items-center justify-center gap-1 rounded-2xl border-2 px-2 py-2 text-[1rem] leading-tight font-bold ${
        active
          ? "border-slate-900 bg-slate-900 text-white"
          : "border-slate-500 bg-white text-slate-800"
      }`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-6 w-6 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {children}
      </svg>
      <span className="text-center">{label}</span>
    </button>
  );
}

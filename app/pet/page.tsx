import Link from "next/link";
import { redirect } from "next/navigation";

import Timeline from "@/components/Timeline";
import { parseReservationParam } from "@/lib/reservationParam";
import { f18FdgPet } from "@/lib/rules";
import { buildTimeline } from "@/lib/schedule";

/**
 * S2 — 개인화 역산 타임라인 (PRD §8 F1)
 *
 * 입력은 URL 파라미터로 받는다.
 *   ?t=202608060825  예약 일시 (개인 식별 정보가 아니다)
 *   ?b=cancer        건물. 없으면 건물명 없이 표기한다
 *
 * 잘못된 값이면 크래시하지 않고 S1 으로 되돌린다.
 * 입력 UI 자체는 T5에서 만든다.
 */
export default async function TimelineScreen({
  searchParams,
}: {
  searchParams: Promise<{ t?: string; b?: string }>;
}) {
  const { t, b } = await searchParams;
  const reservation = parseReservationParam(t);

  if (!reservation) redirect("/");

  const timeline = buildTimeline(f18FdgPet, {
    reservation,
    locationId: b,
  });

  const examDay = timeline[timeline.length - 1];

  return (
    <main className="flex-1 px-4 pt-5 pb-8">
      {/* 잘못 입력했으면 여기서 알아차려야 한다. 전부가 틀어지기 때문이다 */}
      <header className="mb-4 rounded-2xl bg-slate-900 px-4 py-4 text-white">
        <p className="text-[1rem] font-medium text-slate-300">내 검사 예약</p>
        <p className="mt-1 text-[1.65rem] leading-tight font-extrabold">
          {formatReservationLabel(
            examDay.date,
            examDay.weekday,
            reservation.hour,
            reservation.minute,
          )}
        </p>
        {/* 터치 영역 48px 이상 (PRD §13). 음수 마진으로 시각적 여백은 유지한다 */}
        <Link
          href="/"
          className="-mb-2 -ml-2 mt-1 inline-flex min-h-[48px] items-center px-2 text-[1.06rem] font-medium text-slate-300 underline underline-offset-4"
        >
          날짜 · 시각 다시 입력
        </Link>
      </header>

      {/* 무엇을 보고 있는지 먼저 말해 준다. 목록부터 들이밀지 않는다 */}
      <p className="mb-6 text-[1.12rem] leading-relaxed text-slate-700">
        {f18FdgPet.intro}
      </p>

      <Timeline timeline={timeline} ruleset={f18FdgPet} />
    </main>
  );
}

/** "2026-08-06", "목", 8, 25 → "8월 6일(목) 08:25" */
function formatReservationLabel(
  date: string,
  weekday: string,
  hour: number,
  minute: number,
): string {
  const month = Number(date.slice(5, 7));
  const day = Number(date.slice(8, 10));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${month}월 ${day}일(${weekday}) ${pad(hour)}:${pad(minute)}`;
}

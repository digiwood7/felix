import Link from "next/link";
import { redirect } from "next/navigation";

import SummaryCard from "@/components/SummaryCard";
import { parseReservationParam } from "@/lib/reservationParam";
import { f18FdgPet } from "@/lib/rules";
import { buildTimeline } from "@/lib/schedule";

/**
 * S4 — 요약카드 + 배지 (PRD §8 F2)
 *
 * 이 제품의 핵심 산출물. 접수 창구에서 직원에게 보여주는 화면이다.
 *
 * 계산(타임라인)은 서버에서 하고, 응답은 브라우저에만 있으므로
 * 카드 본문은 클라이언트에서 그린다. 응답이 서버로 가는 경로는 없다.
 *
 * 예약 정보가 없으면 카드를 만들 수 없다. S1 으로 되돌린다.
 */
export default async function CardScreen({
  searchParams,
}: {
  searchParams: Promise<{ t?: string; b?: string }>;
}) {
  const { t, b } = await searchParams;

  const reservation = parseReservationParam(t);
  if (!reservation) redirect("/");

  const timeline = buildTimeline(f18FdgPet, { reservation, locationId: b });
  const query = `?t=${t}${b ? `&b=${b}` : ""}`;

  return (
    <main className="flex-1 px-4 pt-5 pb-8">
      <h1 className="mb-4 text-[1.41rem] leading-snug font-extrabold text-slate-900">
        {f18FdgPet.card.title}
      </h1>

      <SummaryCard
        ruleset={f18FdgPet}
        reservation={reservation}
        timeline={timeline}
        locationId={b}
        checkHref={`/pet/check${query}`}
      />

      {/* 카드를 보고 나서 다시 일정으로 돌아갈 길을 남긴다 */}
      <Link
        href={`/pet${query}`}
        className="mt-6 flex min-h-[56px] items-center justify-center rounded-2xl border-2 border-slate-500 px-5 text-[1.12rem] font-bold text-slate-700"
      >
        준비 일정 다시 보기
      </Link>
    </main>
  );
}

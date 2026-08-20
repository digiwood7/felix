import Link from "next/link";
import { redirect } from "next/navigation";

import SummaryCard from "@/components/SummaryCard";
import { parseReservationParam } from "@/lib/reservationParam";
import { f18FdgPet } from "@/lib/rules";
import { locationParam, oneParam } from "@/lib/searchParam";
import { buildTimeline } from "@/lib/schedule";

/**
 * S4 — 요약카드 + 배지 (PRD §8 F2)
 *
 * 이 제품의 핵심 산출물. 접수 창구에서 직원에게 보여주는 화면이다.
 *
 * 계산(타임라인)은 서버에서 하고, 응답은 브라우저에만 있으므로
 * 카드 본문은 클라이언트에서 그린다. 응답이 서버로 가는 경로는 없다.
 *
 * 문답 응답은 `#a=` 조각에 실려 온다 (lib/encode.ts). 그래서 이 주소
 * 하나면 다른 기기에서도 같은 카드가 그려진다 — 서버에 저장한 것도 없고,
 * **조각은 서버로 전송되지도 않는다.** 그래서 여기서는 읽지 않는다.
 *
 * 예약 정보가 없으면 카드를 만들 수 없다. S1 으로 되돌린다.
 */
export default async function CardScreen({
  searchParams,
}: {
  /**
   * 같은 이름이 두 번 오면 값은 배열이다 (`?t=1&t=2`). 주소는 사람이
   * 손으로 고칠 수 있으므로 그 생김새를 타입에 그대로 적어 둔다 —
   * string 이라고 적어 두면 읽는 쪽이 안심하고 자르다 500 을 낸다.
   */
  searchParams: Promise<{ t?: string | string[]; b?: string | string[] }>;
}) {
  const params = await searchParams;
  const t = oneParam(params.t);
  const b = locationParam(f18FdgPet, params.b);

  const reservation = parseReservationParam(t);
  if (!reservation) redirect("/");
  // 건물이 없으면 배지의 연락처를 정할 수 없다 (app/pet/page.tsx 주석 참고)
  if (!b) redirect("/");

  const timeline = buildTimeline(f18FdgPet, { reservation, location: b });
  // 문답으로 되돌아가는 길에는 옛 답을 달고 가지 않는다
  const query = `?t=${t}&b=${b.id}`;

  return (
    <main className="flex-1 px-4 pt-5 pb-8">
      <h1 className="mb-4 text-[1.41rem] leading-snug font-extrabold text-slate-900">
        {f18FdgPet.card.title}
      </h1>

      <SummaryCard
        ruleset={f18FdgPet}
        reservation={reservation}
        timeline={timeline}
        location={b}
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

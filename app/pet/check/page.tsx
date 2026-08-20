import { redirect } from "next/navigation";

import LogView from "@/components/LogView";
import QuestionFlow from "@/components/QuestionFlow";
import { parseReservationParam } from "@/lib/reservationParam";
import { buildQuestions, type ScheduleHints } from "@/lib/questions";
import { f18FdgPet } from "@/lib/rules";
import { buildTimeline, type Timeline } from "@/lib/schedule";
import { locationParam, oneParam } from "@/lib/searchParam";

/**
 * S3 — 상태 문답 (PRD §8 F2)
 *
 * 문항은 lib/questions.ts 에서, 문구는 룰셋에서 온다.
 * 접수에서 실제로 반복되는 4가지만 묻는다 (2026-08-13 확인).
 *
 * 계산된 시각(금식 시작 · 당뇨약 마지노선)을 문답에도 넘긴다.
 * "6시간 금식하셨나요?" 라고 물으면 환자가 뺄셈을 해야 하는데,
 * 그 뺄셈을 대신하는 것이 이 서비스이기 때문이다.
 *
 * 예약 정보가 없으면 여기서 시작할 수 없다. S1 으로 되돌린다.
 */
export default async function CheckScreen({
  searchParams,
}: {
  searchParams: Promise<{ t?: string | string[]; b?: string | string[] }>;
}) {
  const params = await searchParams;
  const t = oneParam(params.t);
  const b = locationParam(f18FdgPet, params.b);

  const reservation = parseReservationParam(t);
  if (!reservation) redirect("/");

  const timeline = buildTimeline(f18FdgPet, { reservation, locationId: b });
  const backHref = `/pet?t=${t}${b ? `&b=${b}` : ""}`;

  return (
    <main className="flex flex-1 flex-col px-4 pt-5 pb-8">
      <LogView screen="s3" examDate={timeline[timeline.length - 1].date} />

      <QuestionFlow
        ruleset={f18FdgPet}
        questions={buildQuestions(f18FdgPet, hintsOf(timeline))}
        backHref={backHref}
        restoredCopy={f18FdgPet.check}
      />
    </main>
  );
}

/**
 * 타임라인에서 문답에 붙일 시각을 뽑는다.
 *
 * 시각을 여기서 다시 계산하지 않는다. S2 에 표시된 값과 한 글자라도
 * 달라지면 환자는 어느 쪽이 맞는지 알 수 없다.
 */
function hintsOf(timeline: Timeline): ScheduleHints {
  const hints: ScheduleHints = {};

  for (const day of timeline) {
    for (const item of day.items) {
      if (!item.time) continue;
      const label = `${labelOf(day.date, day.weekday)} ${item.time}`;
      if (item.kind === "fasting" && !hints.fastingStart) {
        hints.fastingStart = label;
      }
      if (item.kind === "conditional" && !hints.diabetesCutoff) {
        hints.diabetesCutoff = label;
      }
    }
  }

  return hints;
}

/** "2026-08-20", "목" → "8월 20일(목)" */
function labelOf(date: string, weekday: string): string {
  return `${Number(date.slice(5, 7))}월 ${Number(date.slice(8, 10))}일(${weekday})`;
}

import { redirect } from "next/navigation";

import LogView from "@/components/LogView";
import QuestionFlow from "@/components/QuestionFlow";
import { parseReservationParam } from "@/lib/reservationParam";
import {
  buildQuestions,
  deadlineBefore,
  type ScheduleHints,
} from "@/lib/questions";
import { f18FdgPet } from "@/lib/rules";
import { buildTimeline, type Reservation, type Timeline } from "@/lib/schedule";
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
  // 건물이 없으면 배지의 연락처를 정할 수 없다 (app/pet/page.tsx 주석 참고)
  if (!b) redirect("/");

  const timeline = buildTimeline(f18FdgPet, { reservation, location: b });
  const backHref = `/pet?t=${t}&b=${b.id}`;

  return (
    <main className="flex flex-1 flex-col px-4 pt-5 pb-8">
      <LogView screen="s3" examDate={timeline[timeline.length - 1].date} />

      <QuestionFlow
        ruleset={f18FdgPet}
        questions={buildQuestions(
          f18FdgPet,
          hintsOf(f18FdgPet, reservation, timeline),
        )}
        backHref={backHref}
        restoredCopy={f18FdgPet.check}
      />
    </main>
  );
}

/**
 * 문답에 붙일 시각을 뽑는다. **두 종류가 섞여 있으므로 출처가 다르다.**
 *
 * - 안내 문구에 넣는 시각(`fastingStart` · `diabetesCutoff`)은
 *   **타임라인에서** 가져온다. 여기서 다시 계산하면 S2 에 표시된 값과
 *   한 글자라도 달라질 수 있고, 그러면 환자는 어느 쪽이 맞는지 모른다.
 * - 되묻기를 띄우는 기준(`fastingKeptAt`)은 **예약에서** 정확히 잰다.
 *   타임라인 값은 내림돼 있어 판정선보다 최대 59분 이르다. 그것으로
 *   되물으면 6시간을 지킨 환자가 되묻기를 못 받는다 (PRD §9.4).
 */
function hintsOf(
  ruleset: typeof f18FdgPet,
  reservation: Reservation,
  timeline: Timeline,
): ScheduleHints {
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

  const kept = deadlineBefore(reservation, ruleset.fasting.hours);
  // 요일은 타임라인이 이미 구해 두었다. 여기서 다시 요일을 계산하지 않는다
  const keptDay = kept && timeline.find((d) => d.date === kept.date);
  if (kept && keptDay) {
    const pad = (n: number) => String(n).padStart(2, "0");
    hints.fastingKeptAt = kept.at;
    hints.fastingKeptLabel = `${labelOf(keptDay.date, keptDay.weekday)} ${pad(
      kept.at.hour,
    )}:${pad(kept.at.minute)}`;
  }

  return hints;
}

/** "2026-08-20", "목" → "8월 20일(목)" */
function labelOf(date: string, weekday: string): string {
  return `${Number(date.slice(5, 7))}월 ${Number(date.slice(8, 10))}일(${weekday})`;
}

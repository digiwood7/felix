import Link from "next/link";
import { redirect } from "next/navigation";

import CalendarButton from "@/components/CalendarButton";
import CheckCta from "@/components/CheckCta";
import ShareButton from "@/components/ShareButton";
import SpeakButton from "@/components/SpeakButton";
import Timeline from "@/components/Timeline";
import { buildIcs, icsFilename } from "@/lib/ics";
import { buildQuestions } from "@/lib/questions";
import { parseReservationParam } from "@/lib/reservationParam";
import { f18FdgPet } from "@/lib/rules";
import { buildTimeline } from "@/lib/schedule";
import { locationParam, oneParam } from "@/lib/searchParam";
import { speechBlocks } from "@/lib/speech";

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
  searchParams: Promise<{ t?: string | string[]; b?: string | string[] }>;
}) {
  const params = await searchParams;
  const t = oneParam(params.t);
  // 룰셋이 아는 건물만 통과시킨다. 아래 링크에 그대로 되돌려 넣기 때문이다
  const b = locationParam(f18FdgPet, params.b);

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
      <p className="mb-4 text-[1.12rem] leading-relaxed text-slate-700">
        {f18FdgPet.intro}
      </p>

      {/* 전달 기능 — 목록 위에 둔다 (PRD §8 F3).
          듣고 싶은 사람은 읽기 전에 눌러야 하고, 보호자는 화면을 다 읽기
          전에 보내는 경우가 많다. 아래에 두면 스크롤 끝까지 가야 만난다 */}
      <div className="mb-6 flex gap-2">
        <SpeakButton
          blocks={speechBlocks(f18FdgPet, timeline)}
          copy={f18FdgPet.actions}
        />
        <CalendarButton
          ics={buildIcs(f18FdgPet, timeline)}
          filename={icsFilename(f18FdgPet, reservation)}
          copy={f18FdgPet.actions}
        />
        <ShareButton copy={f18FdgPet.actions} />
      </div>

      <Timeline timeline={timeline} ruleset={f18FdgPet} />

      {/* S3 진입은 강제하지 않는다. 타임라인만 보고 나가도 목적의 절반은
          달성된 것이다 (PRD §10). 그래서 링크는 목록 아래에 둔다.
          문항 수도 손으로 적지 않는다 — 문답이 바뀌면 이 줄이 먼저 거짓말을 한다 */}
      <CheckCta
        copy={f18FdgPet.check}
        href={`/pet/check?t=${t}${b ? `&b=${b}` : ""}`}
        examDate={examDay.date}
        questionCount={buildQuestions(f18FdgPet).length}
      />
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

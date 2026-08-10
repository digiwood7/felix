import type { Timeline as TimelineData } from "@/lib/schedule";

/**
 * S2 타임라인 — PRD §8 F1
 *
 * 여기까지가 이 서비스의 최소 가치다. 환자가 여기서 이탈해도 목적의 절반은
 * 달성된다. 그래서 문답으로 가는 버튼보다 타임라인 자체가 읽히는 것이 우선이다.
 *
 * 글자 크기 (PRD §13)
 *   root font-size 가 106.25% 이므로 1rem = 17px 이다.
 *   시각   1.24rem ≈ 21px  (기준 20px 이상)
 *   지시문 1.06rem ≈ 18px
 *   보조   1rem    = 17px  (본문 최소치)
 *
 * 보조 문구를 작게 줄이지 않는다. 대신 색으로 위계를 만든다.
 * 고령 사용자에게 14px 회색 글씨는 없는 것과 같다.
 */
export default function Timeline({ timeline }: { timeline: TimelineData }) {
  return (
    <div className="flex flex-col gap-6">
      {timeline.map((day) => (
        <section key={day.date}>
          <h2 className="mb-2 text-[1.06rem] font-bold text-slate-900">
            {formatDayHeading(day.date)} ({day.weekday})
          </h2>

          <ul className="flex flex-col gap-3 border-t border-slate-200 pt-3">
            {day.items.map((item) => (
              <li
                key={item.id}
                className="grid grid-cols-[3.9rem_1fr] gap-x-3 gap-y-1"
              >
                <span
                  className={
                    item.allDay
                      ? "text-[1.06rem] font-bold text-slate-500 tabular-nums"
                      : "text-[1.24rem] leading-tight font-bold text-slate-900 tabular-nums"
                  }
                >
                  {item.allDay ? "종일" : item.time}
                </span>

                <p className="text-[1.06rem] leading-snug font-medium text-slate-900">
                  {item.text}
                </p>

                {item.notes.map((note) => (
                  <p
                    key={note}
                    className="col-start-2 text-[1rem] leading-snug text-slate-600"
                  >
                    {note}
                  </p>
                ))}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** "2026-08-06" → "8월 6일" */
function formatDayHeading(date: string): string {
  const month = Number(date.slice(5, 7));
  const day = Number(date.slice(8, 10));
  return `${month}월 ${day}일`;
}

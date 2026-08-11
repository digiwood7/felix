import {
  toDateTimeAttr,
  toKoreanDateLabel,
  toKoreanTimeLabel,
} from "@/lib/koreanTime";
import type { ExamRuleset, TimelineItemKind } from "@/lib/rules/types";
import type { Timeline as TimelineData, TimelineItem } from "@/lib/schedule";

/**
 * S2 타임라인 — PRD §8 F1
 *
 * 종이 안내지가 안 읽히는 이유는 정보가 없어서가 아니라
 * **모든 글자가 같은 크기여서** 다. 그래서 환자는 처음부터 끝까지
 * 다 읽어야 자기에게 필요한 줄을 찾는다.
 *
 * 이 화면은 그 반대로 만든다. 훑으면 걸리게.
 *
 * 1. 시각을 압도적으로 키웠다 (37px).
 *    환자의 질문은 "그래서 몇 시부터?" 하나다. 그 답이 가장 커야 한다.
 *
 * 2. 종류를 색 배지로 먼저 알린다 — 금식 · 복약 · 도착 · 검사.
 *    읽기 전에 "이건 내 얘기가 아니다" 를 판단할 수 있어야 건너뛴다.
 *    색은 보조 수단이고 의미는 배지의 글자가 담는다 (PRD §13).
 *
 * 3. 지시문과 참고를 다른 재질로 분리했다.
 *    지시문은 흰 바탕의 큰 글씨, 참고는 회색 박스 안의 작은 글씨.
 *    같은 목록에 회색 점으로 나열하면 결국 한 덩어리로 읽힌다.
 *
 * 4. 시각은 검정으로 고정한다.
 *    색은 분류에만 쓰고, 읽어야 할 글자는 최대 대비를 준다.
 *
 * 글자 크기 — root 106.25% 이므로 1rem = 17px
 *   시각    2.18rem ≈ 37px
 *   지시문  1.35rem ≈ 23px
 *   참고    1.06rem ≈ 18px
 *   배지    0.94rem ≈ 16px (본문이 아닌 라벨)
 */

/**
 * 종류별 색.
 *
 * 배지는 전부 -700 계열이다. 흰 글씨와의 대비를 4.5:1 위로 올리기 위해서다.
 * 색만으로 뜻을 전달하지 않으므로, 색맹 사용자에게도 배지 글자가 그대로 남는다.
 */
const KIND_STYLE: Record<TimelineItemKind, { badge: string; edge: string }> = {
  restriction: { badge: "bg-amber-700", edge: "bg-amber-500" },
  fasting: { badge: "bg-rose-700", edge: "bg-rose-500" },
  conditional: { badge: "bg-violet-700", edge: "bg-violet-500" },
  arrival: { badge: "bg-sky-800", edge: "bg-sky-500" },
  exam: { badge: "bg-slate-800", edge: "bg-slate-600" },
};

export default function Timeline({
  timeline,
  ruleset,
}: {
  timeline: TimelineData;
  ruleset: ExamRuleset;
}) {
  return (
    <div className="flex flex-col gap-8">
      {timeline.map((day, index) => {
        const isExamDay = index === timeline.length - 1;

        return (
          <section key={day.date} aria-labelledby={`day-${day.date}`}>
            {/* 날짜 띠 — 스크롤 중에도 "며칠 얘기인지" 를 놓치지 않게 */}
            <h2
              id={`day-${day.date}`}
              className="mb-3 flex items-center gap-2 border-b-2 border-slate-900 pb-2"
            >
              <time
                dateTime={day.date}
                className="text-[1.35rem] font-extrabold text-slate-900"
              >
                {toKoreanDateLabel(day.date)}
              </time>
              <span className="text-[1.06rem] font-bold text-slate-600">
                {day.weekday}요일
              </span>
              <span className="ml-auto text-[1.06rem] font-bold text-slate-600">
                {isExamDay ? "검사 당일" : "검사 전날"}
              </span>
            </h2>

            <ul className="flex flex-col gap-3">
              {day.items.map((item) => (
                <Item
                  key={item.id}
                  item={item}
                  date={day.date}
                  label={ruleset.labels[item.kind]}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function Item({
  item,
  date,
  label,
}: {
  item: TimelineItem;
  date: string;
  label: string;
}) {
  const style = KIND_STYLE[item.kind];

  return (
    <li className="flex overflow-hidden rounded-2xl border border-slate-200">
      {/* 색 띠 — 훑을 때 종류가 먼저 눈에 들어오게 */}
      <div aria-hidden="true" className={`w-1.5 shrink-0 ${style.edge}`} />

      <div className="min-w-0 flex-1 px-4 py-4">
        <div className="mb-1.5 flex items-center gap-2">
          <span
            className={`rounded-md px-2 py-0.5 text-[0.94rem] font-bold text-white ${style.badge}`}
          >
            {label}
          </span>

          {item.allDay && (
            <span className="text-[1.06rem] font-bold text-slate-700">
              하루 종일
            </span>
          )}
        </div>

        {/* 시각 — 환자의 질문은 "몇 시부터?" 하나다. 가장 크게 */}
        {!item.allDay && (
          <p className="mb-1">
            <time
              dateTime={toDateTimeAttr(date, item.time)}
              aria-label={toKoreanTimeLabel(item.time!)}
              className="text-[2.18rem] leading-none font-extrabold text-slate-900 tabular-nums"
            >
              {item.time}
            </time>
          </p>
        )}

        {/* 지시문 — 반드시 지킬 것 */}
        <p className="text-[1.35rem] leading-snug font-bold text-slate-900">
          {item.text}
        </p>

        {/* 참고 — 다른 재질로 분리한다. 같은 목록에 두면 한 덩어리가 된다 */}
        {item.notes.length > 0 && (
          <ul className="mt-3 flex flex-col gap-2 rounded-xl bg-slate-100 px-3.5 py-3">
            {item.notes.map((note) => (
              <li
                key={note}
                className="text-[1.06rem] leading-snug text-slate-700"
              >
                {note}
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

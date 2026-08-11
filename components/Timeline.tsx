import {
  toDateTimeAttr,
  toKoreanDateLabel,
  toKoreanTimeLabel,
} from "@/lib/koreanTime";
import type { Timeline as TimelineData, TimelineItem } from "@/lib/schedule";

/**
 * S2 타임라인 — PRD §8 F1
 *
 * 가독성 설계 (WCAG 2.2 AA + 고령 사용자)
 *
 * 1. 시각을 좌측 컬럼이 아니라 위로 올렸다.
 *    컬럼으로 두면 본문 폭이 375px 화면에서 257px까지 줄어
 *    한 문장이 3줄로 쪼개진다. 위로 올리면 본문이 전체 폭을 쓴다.
 *
 * 2. 항목마다 카드로 끊었다.
 *    "지금 할 일"이 시각적으로 하나씩 분리되어야 스캔이 된다.
 *
 * 3. 지시문과 보조를 가로선으로 갈랐다.
 *    반드시 지킬 것(지시문)과 참고할 것(보조)이 섞이지 않게 한다.
 *
 * 4. 색으로만 구분하지 않는다 (PRD §13).
 *    위계는 크기 · 굵기 · 위치로 만든다.
 *
 * 글자 크기 — root 106.25% 이므로 1rem = 17px
 *   시각    1.41rem ≈ 24px  (기준 20px 이상)
 *   지시문  1.18rem ≈ 20px
 *   보조    1rem    = 17px  (본문 최소치)
 *
 * 대비 (흰 배경 기준)
 *   slate-900 #0f172a → 17.9:1
 *   slate-700 #334155 → 10.7:1
 *   전부 AA(4.5:1) 통과. 보조 문구도 slate-600 대신 700을 쓴다.
 */
export default function Timeline({ timeline }: { timeline: TimelineData }) {
  return (
    <div className="flex flex-col gap-7">
      {timeline.map((day, index) => {
        const isExamDay = index === timeline.length - 1;

        return (
          <section key={day.date} aria-labelledby={`day-${day.date}`}>
            <h2
              id={`day-${day.date}`}
              className="mb-3 flex items-baseline gap-2"
            >
              <time
                dateTime={day.date}
                className="text-[1.18rem] font-bold text-slate-900"
              >
                {toKoreanDateLabel(day.date)} {day.weekday}요일
              </time>
              {isExamDay && (
                <span className="rounded-full bg-slate-900 px-2.5 py-0.5 text-[0.94rem] font-bold text-white">
                  검사일
                </span>
              )}
            </h2>

            <ul className="flex flex-col gap-3">
              {day.items.map((item) => (
                <Item key={item.id} item={item} date={day.date} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function Item({ item, date }: { item: TimelineItem; date: string }) {
  return (
    <li className="rounded-2xl border border-slate-200 bg-white px-4 py-3.5">
      {/* 시각 — 이 카드의 앵커. 숫자로 보여주고 읽기는 aria-label 로 준다 */}
      <p className="mb-1.5">
        {item.allDay ? (
          <span className="text-[1.18rem] font-bold text-slate-700">종일</span>
        ) : (
          <time
            dateTime={toDateTimeAttr(date, item.time)}
            aria-label={toKoreanTimeLabel(item.time!)}
            className="text-[1.41rem] leading-none font-bold text-slate-900 tabular-nums"
          >
            {item.time}
          </time>
        )}
      </p>

      {/* 지시문 — 반드시 지킬 것 */}
      <p className="text-[1.18rem] leading-snug font-semibold text-slate-900">
        {item.text}
      </p>

      {/* 보조 — 참고할 것. 지시문과 선으로 가른다 */}
      {item.notes.length > 0 && (
        <ul className="mt-2.5 flex flex-col gap-1.5 border-t border-slate-100 pt-2.5">
          {item.notes.map((note) => (
            <li
              key={note}
              className="flex gap-1.5 text-[1rem] leading-snug text-slate-700"
            >
              <span aria-hidden="true" className="text-slate-400">
                ·
              </span>
              <span>{note}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

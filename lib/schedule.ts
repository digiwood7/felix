import type { ExamRuleset, RoundMode, TimeOfDay } from "./rules/types";

/**
 * 시각 계산 엔진 — PRD §9.2
 *
 * 안전 불변조건
 *   1. 모든 시각은 내림(floor). 반올림은 어떤 경우에도 없다.
 *      금식 · 복약 마지노선 → floor_hour / 도착 → floor_10min
 *   2. 새벽 보정을 하지 않는다. 계산값을 그대로 쓴다.
 *   3. 모든 계산은 KST 고정이다.
 *
 * 타임존을 다루는 방법
 *   한국은 서머타임이 없으므로 KST는 항상 UTC+9다. 즉 벽시계 시각의
 *   덧뺄셈만 정확하면 되고, 오프셋 변환은 필요하지 않다.
 *
 *   그래서 KST 벽시계 시각을 "UTC인 척" 다룬다. Date.UTC() 와 getUTC*() 만
 *   쓰면 기기 로컬 타임존이 결과에 개입할 여지가 없고, 월말 · 연말 · 윤년
 *   넘김은 Date가 알아서 처리한다.
 *
 *   new Date(y, m, d) 나 getHours() 처럼 로컬 타임존을 따르는 API는
 *   이 파일에서 절대 쓰지 않는다.
 */

export interface Reservation {
  year: number;
  /** 1~12 */
  month: number;
  day: number;
  hour: number;
  minute: number;
}

export interface TimelineInput {
  reservation: Reservation;
  /** 룰셋 locations.options 의 id. 없으면 건물명 없이 표기한다 */
  locationId?: string;
}

export type TimelineItemKind =
  | "restriction"
  | "fasting"
  | "conditional"
  | "arrival"
  | "exam";

export interface TimelineItem {
  kind: TimelineItemKind;
  id: string;
  /** "HH:MM". 종일 항목이면 null */
  time: string | null;
  allDay: boolean;
  text: string;
  notes: string[];
}

export interface TimelineDay {
  /** "YYYY-MM-DD" */
  date: string;
  /** "월" ~ "일" */
  weekday: string;
  items: TimelineItem[];
}

export type Timeline = TimelineDay[];

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

const MS_PER_MINUTE = 60_000;

/** KST 벽시계 시각을 UTC로 간주한 epoch. 로컬 타임존이 개입하지 않는다 */
function toEpoch(r: Reservation): number {
  return Date.UTC(r.year, r.month - 1, r.day, r.hour, r.minute);
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function dateOf(epoch: number): string {
  const d = new Date(epoch);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function timeOf(epoch: number): string {
  const d = new Date(epoch);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

function weekdayOf(epoch: number): string {
  return WEEKDAYS[new Date(epoch).getUTCDay()];
}

/**
 * 내림. 반올림하지 않는다.
 * 계산 오류가 나도 항상 이른 쪽으로만 틀리게 만드는 지점이다.
 */
function floorTo(epoch: number, mode: RoundMode): number {
  const d = new Date(epoch);
  const minutes = d.getUTCMinutes();

  const dropped =
    mode === "floor_hour" ? minutes : minutes % 10; /* floor_10min */

  return epoch - dropped * MS_PER_MINUTE - d.getUTCSeconds() * 1000;
}

function minutesOfDay(epoch: number): number {
  const d = new Date(epoch);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

function parseTimeOfDay(value: TimeOfDay): number {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

/** 시작 포함, 끝 미포함. 06:00 은 ["00:00","06:00"] 구간 밖이다 */
function isWithin(epoch: number, [from, to]: [TimeOfDay, TimeOfDay]): boolean {
  const value = minutesOfDay(epoch);
  return value >= parseTimeOfDay(from) && value < parseTimeOfDay(to);
}

/** 80 → "1시간 20분" */
function formatDuration(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) return `${minutes}분`;
  if (minutes === 0) return `${hours}시간`;
  return `${hours}시간 ${minutes}분`;
}

/**
 * 허용 음료와 금지 음료를 각각 한 줄로 만든다.
 *
 * 한 줄로 합치면 "물(생수)만 가능 · ✕ 보리차 커피 우유 주스 껌 사탕" 이 되어
 * 좁은 화면에서 두 줄로 접힌다. 마실 수 있는 것과 없는 것은 따로 읽혀야 한다.
 */
function allowedLine(allowed: string[]): string {
  return `${allowed.join(" · ")}만 가능합니다`;
}

function forbiddenLine(forbidden: string[]): string | null {
  return forbidden.length === 0 ? null : `✕ ${forbidden.join(" ")}`;
}

function resolveLocation(ruleset: ExamRuleset, locationId?: string): string {
  const found = ruleset.locations.options.find((o) => o.id === locationId);
  return found?.text ?? ruleset.locations.fallback_text;
}

interface Placed {
  epoch: number | null;
  /** 종일 항목이 놓이는 날짜 */
  date: string;
  item: TimelineItem;
}

export function buildTimeline(
  ruleset: ExamRuleset,
  input: TimelineInput,
): Timeline {
  const examEpoch = toEpoch(input.reservation);
  const placed: Placed[] = [];

  // 제한 — 예약 전날 종일 (운동 등)
  for (const restriction of ruleset.restrictions) {
    const dayBefore = examEpoch - 24 * 60 * MS_PER_MINUTE;
    placed.push({
      epoch: null,
      date: dateOf(dayBefore),
      item: {
        kind: "restriction",
        id: restriction.id,
        time: null,
        allDay: true,
        text: restriction.text,
        notes: [],
      },
    });
  }

  // 금식
  const fasting = ruleset.fasting;
  const fastingEpoch = floorTo(
    examEpoch - fasting.hours * 60 * MS_PER_MINUTE,
    fasting.round,
  );

  const fastingNotes: string[] = [];
  if (
    fasting.note &&
    (!fasting.note_if_between || isWithin(fastingEpoch, fasting.note_if_between))
  ) {
    fastingNotes.push(fasting.note);
  }
  fastingNotes.push(allowedLine(fasting.allowed));

  const forbidden = forbiddenLine(fasting.forbidden);
  if (forbidden) fastingNotes.push(forbidden);

  if (fasting.allowed_note) fastingNotes.push(fasting.allowed_note);

  placed.push({
    epoch: fastingEpoch,
    date: dateOf(fastingEpoch),
    item: {
      kind: "fasting",
      id: "fasting",
      time: timeOf(fastingEpoch),
      allDay: false,
      text: fasting.text,
      notes: fastingNotes,
    },
  });

  // 조건부 항목 — 묻지 않고 조건부 문구로 항상 표시한다 (PRD §8 F1)
  for (const rule of ruleset.conditional) {
    const epoch = floorTo(
      examEpoch + rule.offset_h * 60 * MS_PER_MINUTE,
      rule.round,
    );
    placed.push({
      epoch,
      date: dateOf(epoch),
      item: {
        kind: "conditional",
        id: rule.id,
        time: timeOf(epoch),
        allDay: false,
        text: rule.text,
        notes: [rule.after_text],
      },
    });
  }

  // 도착
  const arrival = ruleset.arrival;
  const arrivalEpoch = floorTo(
    examEpoch - arrival.before_min * MS_PER_MINUTE,
    arrival.round,
  );

  placed.push({
    epoch: arrivalEpoch,
    date: dateOf(arrivalEpoch),
    item: {
      kind: "arrival",
      id: "arrival",
      time: timeOf(arrivalEpoch),
      allDay: false,
      text: arrival.text.replace(
        "{location}",
        resolveLocation(ruleset, input.locationId),
      ),
      notes: arrival.note ? [arrival.note] : [],
    },
  });

  // 검사 시작 — 예약 시각 그대로. 내림하지 않는다
  placed.push({
    epoch: examEpoch,
    date: dateOf(examEpoch),
    item: {
      kind: "exam",
      id: "exam",
      time: timeOf(examEpoch),
      allDay: false,
      text: ruleset.exam.text.replace(
        "{duration}",
        formatDuration(ruleset.duration_min),
      ),
      notes: [],
    },
  });

  return groupByDate(placed);
}

function groupByDate(placed: Placed[]): Timeline {
  const byDate = new Map<string, Placed[]>();

  for (const entry of placed) {
    const bucket = byDate.get(entry.date);
    if (bucket) bucket.push(entry);
    else byDate.set(entry.date, [entry]);
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, entries]) => {
      // 종일 항목이 먼저, 그 다음 시각 오름차순
      entries.sort((a, b) => {
        if (a.epoch === null) return b.epoch === null ? 0 : -1;
        if (b.epoch === null) return 1;
        return a.epoch - b.epoch;
      });

      // 요일은 그 날짜의 정오 기준으로 구한다 (자정 경계 영향 배제)
      const noon = Date.UTC(
        Number(date.slice(0, 4)),
        Number(date.slice(5, 7)) - 1,
        Number(date.slice(8, 10)),
        12,
      );

      return {
        date,
        weekday: weekdayOf(noon),
        items: entries.map((e) => e.item),
      };
    });
}

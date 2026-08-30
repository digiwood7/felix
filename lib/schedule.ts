import type {
  ExamRuleset,
  LocationOption,
  RoundMode,
  TimeOfDay,
  TimelineItemKind,
} from "./rules/types";

export type { TimelineItemKind };

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
  /**
   * 검사받을 건물. 주소를 읽는 문에서 이미 해석되어 들어온다.
   *
   * id 가 아니라 건물 자체를 받는다 — 여기서 다시 찾으면 "모르는 건물"
   * 이라는 경우가 생기고, 그 경우의 답을 화면마다 따로 정하게 된다.
   */
  location: LocationOption;
}

export interface TimelineItem {
  kind: TimelineItemKind;
  id: string;
  /** "HH:MM". 종일 항목이면 null */
  time: string | null;
  allDay: boolean;
  text: string;
  /**
   * 낭독 전용 문구. 없으면(null) 읽어주기가 `text` 를 그대로 읽는다.
   *
   * `{time}` 자리는 lib/speech.ts 가 채운다 — 시각을 말로 바꾸는 것은
   * 소리 쪽의 일이고, 화면은 이 문구를 쓰지 않는다.
   */
  speechText: string | null;
  notes: string[];
  /**
   * 검사 항목에만 붙는 구간 목록. 다른 항목에는 없다.
   *
   * 여기서 길이를 이미 말("약 50분")로 바꿔 둔다. 화면과 소리가 같은
   * 문자열을 쓰게 하려는 것이다 — 한쪽에서 다시 계산하면 언젠가 갈린다.
   */
  phases?: TimelinePhases;
}

export interface TimelinePhases {
  title: string;
  items: TimelinePhase[];
}

export interface TimelinePhase {
  id: string;
  /**
   * "약 50분". **HH:MM 형태를 만들지 않는다** — 큰 글씨의 시각과 같은
   * 생김새가 되는 순간 "50분" 이 "50분에" 로 읽힌다.
   */
  duration: string;
  text: string;
  /**
   * 이 구간만의 낭독 문구 틀. 없으면(null) 소리는 검사 공통 틀을 쓴다.
   *
   * 자리표시자를 채우지 않은 채로 넘긴다 — 채우는 것은 소리 쪽의
   * 일이고(lib/speech.ts), 화면은 이 문구를 쓰지 않는다.
   */
  speechText: string | null;
  /** 접힌 줄의 제목. 없으면 접을 것이 없다 */
  noteSummary: string | null;
  /** 접힌 줄의 낭독 문구. 없으면(null) 소리도 noteSummary 를 그대로 읽는다 */
  noteSummarySpeech: string | null;
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

/** 표기용으로 다른 모듈도 쓴다. 요일 배열이 두 벌이 되면 언젠가 어긋난다 */
export const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

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
 * 허용 · 금지 음식을 각각 한 줄로 만든다. 문구 틀은 룰셋에서 읽는다.
 *
 * ✕ 같은 기호를 쓰지 않는다.
 *   고령 환자가 기호를 "금지"로 읽는다는 보장이 없고,
 *   스크린리더는 "곱하기"로 읽거나 건너뛴다 (WCAG 1.1.1).
 *   의미는 기호가 아니라 말에 담는다.
 *
 * "~도 안 됩니다" 인 이유
 *   이 목록의 핵심은 "껌·사탕은 음식이 아니니 괜찮겠지" 를 막는 것이다.
 *   "도" 가 그 오해를 정면으로 짚는다.
 */
function itemsLine(template: string, items: string[]): string {
  return template.replace("{items}", items.join(", "));
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
        speechText: restriction.speech_text ?? null,
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
  fastingNotes.push(itemsLine(fasting.allowed_text, fasting.allowed));

  if (fasting.forbidden.length > 0) {
    fastingNotes.push(itemsLine(fasting.forbidden_text, fasting.forbidden));
  }

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
      speechText: fasting.speech_text ?? null,
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
        speechText: rule.speech_text ?? null,
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

  const location = input.location.text;

  placed.push({
    epoch: arrivalEpoch,
    date: dateOf(arrivalEpoch),
    item: {
      kind: "arrival",
      id: "arrival",
      time: timeOf(arrivalEpoch),
      allDay: false,
      text: arrival.text.replace("{location}", location),
      speechText: arrival.speech_text?.replace("{location}", location) ?? null,
      notes: arrival.notes ?? [],
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
      speechText:
        ruleset.exam.speech_text?.replace(
          "{duration}",
          formatDuration(ruleset.duration_min),
        ) ?? null,
      notes: [],
      phases: examPhases(ruleset),
    },
  });

  return groupByDate(placed);
}

/**
 * 검사실 안에서의 구간 목록.
 *
 * **시각을 만들지 않는다.** 예약 시각에 5분씩 더해 나가면 그럴듯한
 * 진행표가 나오지만, 앞 검사가 20분 밀리는 순간 그 표는 전부 틀린다.
 * 밀려도 틀리지 않는 것은 길이뿐이다 (lib/rules/types.ts ExamPhase).
 *
 * 룰셋에 phases 가 없으면 아무것도 만들지 않는다 — 검사에 따라
 * 구간을 나눠 알릴 것이 없을 수 있다.
 */
function examPhases(ruleset: ExamRuleset): TimelinePhases | undefined {
  const { phases, phases_title, phase_duration_text } = ruleset.exam;
  if (!phases || phases.length === 0 || !phases_title) return undefined;

  return {
    title: phases_title,
    items: phases.map((phase) => ({
      id: phase.id,
      duration: (phase_duration_text ?? "{duration}").replace(
        "{duration}",
        formatDuration(phase.min),
      ),
      text: phase.text,
      speechText: phase.speech_text ?? null,
      noteSummary: phase.note_summary ?? null,
      noteSummarySpeech: phase.note_summary_speech ?? null,
      notes: phase.notes ?? [],
    })),
  };
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

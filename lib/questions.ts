import type {
  AnswerableFrom,
  ExamRuleset,
  NumberField,
  TimeCopy,
} from "./rules/types";
import type { Reservation } from "./schedule";

/**
 * 상태 문답 정의 — PRD §8 F2
 *
 * **문항은 전부 여기서 정의한다.** 화면 컴포넌트에 흩뿌리지 않는다.
 *
 * 문항 4개는 접수에서 실제로 반복되는 질문 그대로다 (2026-08-13 확인).
 *
 *   1. 6시간 금식 여부 — 못 지켰으면 마지막으로 드신 때
 *   2. 당뇨 — 있으면 당뇨약 · 인슐린을 마지막으로 쓴 때
 *   3. 키 · 몸무게 — 모르면 모른다고 답할 수 있다
 *   4. 만 50세 이하 여성이면 임신 · 수유 · 생리 여부
 *
 * 늘리지 않는다. 문항이 늘면 40초 완주 기준을 넘기고(WORKFLOW W2 게이트),
 * 접수에서 어차피 묻지 않는 항목은 물어봐야 접수 시간이 줄지 않는다.
 *
 * 자유 텍스트 입력을 만들지 않는다. 문구와 선택지는 룰셋에서 읽는다.
 */

/** 예약일 기준 상대 날짜. 절대 날짜를 묻지 않는다 — 환자가 헷갈린다 */
export type DayRef = "yesterday" | "today";

export interface TimeAnswer {
  day: DayRef;
  hour: number;
  minute: number;
}

export type QuestionId = "fasting" | "diabetes" | "body" | "female";

/**
 * "셋 다 해당사항 없음" 을 고른 상태.
 *
 * 아무것도 고르지 않은 것과 구분한다. 접수 직원이 카드를 볼 때
 * "안 물어봤다" 와 "물어봤고 해당 없다" 는 완전히 다른 정보다.
 * 룰셋 flags 에 없는 id 이므로 배지 판정에는 걸리지 않는다.
 */
export const NONE_ID = "none";

export interface Question {
  id: QuestionId;
  /** 화면 맨 위 질문 */
  title: string;
  /** 질문 아래 한 줄. 없으면 생략 */
  hint?: string;
  /** 왼쪽 버튼 — 항상 긍정("네" · "예") */
  yesLabel: string;
  /** 오른쪽 버튼 — 항상 부정("아니요" · "아니오") */
  noLabel: string;
  /** 갈래를 타면 이어서 묻는 시각 */
  timeTitle?: string;
  time?: TimeCopy;
  /**
   * 이 시각과 같거나 이르면 금식을 지킨 것이다 (금식 문항 전용).
   *
   * "아니요" 와 어긋나는 시각을 골랐을 때 되묻기를 띄우는 기준.
   * 없으면 되묻지 않는다.
   *
   * **배지 판정선과 같은 값이어야 한다** — 내림된 표시값을 넣지 않는다.
   * `ScheduleHints.fastingKeptAt` 참고.
   */
  keptBefore?: TimeAnswer;
  recheck?: {
    note: string;
    ask: string;
    hint: string;
    yesLabel: string;
    noLabel: string;
  };
  /** 갈래를 타면 이어서 고르는 항목 */
  detailTitle?: string;
  options?: { id: string; label: string }[];
  noneLabel?: string;
  /** 생리 일수처럼 항목에 딸린 추가 질문 */
  dayTitle?: string;
  dayMax?: number;
  dayUnit?: string;
  /** 직접 입력받는 숫자 */
  fields?: NumberField[];
  unknownLabel?: string;
  /**
   * 이 문항이 열리는 시점. 없으면 언제든 답할 수 있다.
   *
   * **화면에 뜬 값(내림) 이다.** 판정선이 아니다 — 잠긴 문항이
   * "03:00부터" 라고 말하는데 03:10 에 잠겨 있으면, 환자는 화면
   * 두 곳의 숫자를 대조하게 된다 (PRD §9.4).
   */
  opensAt?: OpensAt;
}

/** 문항이 열리는 시점. 화면에 그대로 뜨는 값이다 */
export interface OpensAt {
  /** "YYYY-MM-DD" */
  date: string;
  /** "HH:MM" */
  time: string;
  /** 화면에 쓰는 표기 — "8월 31일(월) 03:00" */
  label: string;
}

/**
 * 계산된 시각을 문답 화면에도 그대로 보여 준다.
 *
 * 금식 문항은 "6시간" 이라고 묻지만, 그 6시간이 몇 시부터인지는
 * 서비스가 이미 계산해 두었다. 그 시각을 같이 보여 주면 환자가
 * 뺄셈을 하지 않아도 된다. S2 타임라인에 뜬 바로 그 숫자다.
 */
export interface ScheduleHints {
  /** 금식 시작 — "8월 20일(목) 08:00" */
  fastingStart?: string;
  /** 당뇨약 · 인슐린 마지노선 */
  diabetesCutoff?: string;
  /**
   * 금식을 지킨 것이 되는 마지막 시각 — **판정선이다.**
   *
   * `fastingStart`(내림된 표시값)가 아니다. 되묻기는 "환자가 답한 시각으로
   * 보면 실은 지킨 것 아닌가" 를 묻는 것이므로, **배지가 쓰는 자[尺]와
   * 같은 자로 재야 한다.** 내림값으로 재면 표시값과 판정선 사이(17:30
   * 예약의 11:01~11:30)에서 되묻기가 뜨지 않아, 6시간을 지킨 환자가
   * 🟡 에 갇힌 채 빠져나올 길이 없어진다 (PRD §9.4).
   */
  fastingKeptAt?: TimeAnswer;
  /** 위 판정선의 표기 — "8월 20일(목) 02:25". 되묻기 문구에 들어간다 */
  fastingKeptLabel?: string;
  /**
   * 문항을 여는 시점을 기준점별로 모아 둔 표.
   *
   * 값은 **타임라인에 뜬 것과 같은 숫자**다 (내림). 화면이 "03:00부터"
   * 라고 말했으면 03:00 에 열려야 한다. 여기서 다시 계산하지 않는
   * 이유도 같다 — 두 곳에서 계산하면 언젠가 한 글자가 갈린다.
   *
   * "always" 는 담지 않는다. 담을 시점이 없는 것이 곧 always 다.
   */
  opensAt?: Partial<Record<Exclude<AnswerableFrom, "always">, OpensAt>>;
}

/** 판정선 한 지점 */
export interface Deadline {
  /** 문답의 어제/오늘 + 시각 */
  at: TimeAnswer;
  /** "YYYY-MM-DD". 요일을 붙일 때 타임라인에서 그 날을 찾는 데 쓴다 */
  date: string;
}

/**
 * 예약 시각에서 기준 시간을 **정확히** 뺀 지점 (PRD §9.4).
 *
 * **내림하지 않는다.** 내림은 환자에게 안내하는 시각에만 쓴다.
 * 이 값은 판정과 되묻기가 같이 쓰는 자[尺]이므로, 여기서 한 번만
 * 계산하고 양쪽이 그것을 읽는다 — 자가 둘로 갈리면 그 사이에
 * 규칙을 지킨 환자가 낀다.
 *
 * 예약일 당일과 전날만 돌려준다. 그 밖이면 undefined — 되묻기를
 * 띄우지 않는 쪽으로 떨어진다 (`relativeTimeOf` 와 같은 규칙).
 *
 * Date.UTC / getUTC* 만 쓴다. 기기 타임존이 무엇이든 결과가 같다 (PRD §9.2).
 */
export function deadlineBefore(
  reservation: Reservation,
  hours: number,
): Deadline | undefined {
  const at = new Date(
    Date.UTC(
      reservation.year,
      reservation.month - 1,
      reservation.day,
      reservation.hour,
      reservation.minute,
    ) -
      hours * 3_600_000,
  );

  const diff =
    (Date.UTC(reservation.year, reservation.month - 1, reservation.day) -
      Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate())) /
    86_400_000;

  if (diff !== 0 && diff !== 1) return undefined;

  const pad = (n: number) => String(n).padStart(2, "0");

  return {
    at: {
      day: diff === 0 ? "today" : "yesterday",
      hour: at.getUTCHours(),
      minute: at.getUTCMinutes(),
    },
    date: `${at.getUTCFullYear()}-${pad(at.getUTCMonth() + 1)}-${pad(at.getUTCDate())}`,
  };
}

/**
 * 타임라인의 날짜 · 시각을 예약일 기준 상대 시각으로 옮긴다.
 *
 * 예약일 당일과 전날만 돌려준다. 그 밖이면 undefined — 되묻기를
 * 띄우지 않는 쪽으로 떨어진다. 금식은 6시간이라 전날을 넘지 않지만,
 * 룰셋의 시간이 늘면 이 함수가 먼저 막는다.
 *
 * Date.UTC 만 쓴다. 기기 타임존이 무엇이든 결과가 같다 (PRD §9.2).
 */
export function relativeTimeOf(
  date: string,
  time: string,
  examDate: string,
): TimeAnswer | undefined {
  const days = (d: string) =>
    Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)));

  const diff = (days(examDate) - days(date)) / 86_400_000;
  if (diff !== 0 && diff !== 1) return undefined;

  return {
    day: diff === 0 ? "today" : "yesterday",
    hour: Number(time.slice(0, 2)),
    minute: Number(time.slice(3, 5)),
  };
}

/** 앞의 시각이 뒤의 시각과 같거나 이른가. 어제가 오늘보다 앞이다 */
export function atOrBefore(a: TimeAnswer, b: TimeAnswer): boolean {
  const rank = (t: TimeAnswer) =>
    (t.day === "yesterday" ? 0 : 1440) + t.hour * 60 + t.minute;
  return rank(a) <= rank(b);
}

/**
 * 그 기준점이 가리키는 시각. "always" 거나 시점을 모르면 undefined —
 * 잠그지 않는 쪽으로 떨어진다.
 *
 * 시점을 모르는 채로 잠그면 답할 길이 사라진다. 이 게이트는 헛수고를
 * 줄이려고 있는 것이지 문답을 막으려고 있는 것이 아니다.
 */
function openOf(
  from: AnswerableFrom | undefined,
  hints: ScheduleHints,
): OpensAt | undefined {
  if (!from || from === "always") return undefined;
  return hints.opensAt?.[from];
}

export function buildQuestions(
  ruleset: ExamRuleset,
  hints: ScheduleHints = {},
): Question[] {
  const q = ruleset.questions;
  const diabetes = ruleset.conditional.find((c) => c.id === "diabetes");

  return [
    {
      id: "fasting",
      opensAt: openOf(q.fasting.answerable_from, hints),
      title: q.fasting.ask,
      hint: hints.fastingStart
        ? `${hints.fastingStart}부터 금식입니다. ${itemsLine(
            ruleset.fasting.allowed_text,
            ruleset.fasting.allowed,
          )}`
        : itemsLine(ruleset.fasting.allowed_text, ruleset.fasting.allowed),
      yesLabel: q.fasting.yes_label,
      noLabel: q.fasting.no_label,
      timeTitle: q.fasting.time_ask,
      time: q.time,
      keptBefore: hints.fastingKeptAt,
      // 되묻기는 판정선이 있을 때만 성립한다
      recheck: hints.fastingKeptAt && hints.fastingKeptLabel
        ? {
            note: q.fasting.recheck_note.replace(
              "{time}",
              hints.fastingKeptLabel,
            ),
            ask: q.fasting.recheck_ask,
            hint: itemsLine(q.fasting.recheck_hint, ruleset.fasting.forbidden),
            yesLabel: q.fasting.recheck_yes,
            noLabel: q.fasting.recheck_no,
          }
        : undefined,
    },
    {
      id: "diabetes",
      opensAt: openOf(q.diabetes.answerable_from, hints),
      title: diabetes?.ask ?? "당뇨약이나 인슐린을 사용하시나요?",
      hint: hints.diabetesCutoff
        ? `${hints.diabetesCutoff}까지만 사용 가능합니다`
        : undefined,
      yesLabel: q.diabetes.yes_label,
      noLabel: q.diabetes.no_label,
      timeTitle: q.diabetes.time_ask,
      time: q.time,
    },
    {
      id: "body",
      opensAt: openOf(q.body.answerable_from, hints),
      title: q.body.ask,
      hint: q.body.hint,
      // 두 갈래 버튼이 없는 유일한 문항이다
      yesLabel: "",
      noLabel: "",
      fields: [q.body.height, q.body.weight],
      unknownLabel: q.body.unknown_label,
    },
    {
      id: "female",
      opensAt: openOf(q.female.answerable_from, hints),
      title: q.female.ask,
      hint: q.female.hint,
      yesLabel: q.female.yes_label,
      noLabel: q.female.no_label,
      detailTitle: q.female.detail_ask,
      options: ruleset.flags.map((f) => ({ id: f.id, label: f.q })),
      noneLabel: q.female.none_label,
      dayTitle: q.female.day_ask,
      dayMax: q.female.day_max,
      dayUnit: q.female.day_unit,
    },
  ];
}

/** "{items}만 가능합니다" + ["물(생수)"] → "물(생수)만 가능합니다" */
function itemsLine(template: string, items: string[]): string {
  return template.replace("{items}", items.join(" · "));
}

/** 일수를 물어야 하는 항목. 룰셋 flags 의 id 와 맞춘다 */
export const MENSTRUATION_ID = "menstruation";

/** 문답 응답. 서버로 보내지 않는다 (PRD §8 F2) */
export interface Answers {
  /** null = 아직 답하지 않음. kept=true 면 6시간 금식을 지켰다 */
  fasting: { kept: boolean; time: TimeAnswer | null } | null;
  /** null = 아직 답하지 않음. uses=false 면 당뇨약 · 인슐린 없음 */
  diabetes: { uses: boolean; time: TimeAnswer | null } | null;
  /** unknown = 모른다고 답했다. 접수에서 측정한다 */
  body: { height: number | null; weight: number | null; unknown: boolean };
  /**
   * null = 아직 답하지 않음. applies=false 면 해당 없음.
   *
   * 나이도 성별도 저장하지 않는다. 저장하는 것은 "이 문항이 해당되는가"와
   * 해당될 때 고른 항목, 그리고 생리 일수뿐이다.
   */
  female: {
    applies: boolean;
    checks: string[];
    menstrualDay: number | null;
  } | null;
}

export function emptyAnswers(): Answers {
  return {
    fasting: null,
    diabetes: null,
    body: { height: null, weight: null, unknown: false },
    female: null,
  };
}

/** 범위를 벗어난 숫자는 답으로 받지 않는다 */
export function isValidNumber(field: NumberField, value: number | null) {
  return value !== null && value >= field.min && value <= field.max;
}

/** 다음으로 넘어갈 수 있는지 */
export function isAnswered(question: Question, a: Answers): boolean {
  switch (question.id) {
    case "fasting":
      // 시각을 고르기 전에는 넘기지 않는다. 기본값을 채워 두면
      // 환자가 고르지 않은 시각으로 금식 위반 여부가 판정된다
      return a.fasting !== null && (a.fasting.kept || a.fasting.time !== null);
    case "diabetes":
      return (
        a.diabetes !== null && (!a.diabetes.uses || a.diabetes.time !== null)
      );
    case "body": {
      if (a.body.unknown) return true;
      const [height, weight] = question.fields!;
      return (
        isValidNumber(height, a.body.height) &&
        isValidNumber(weight, a.body.weight)
      );
    }
    case "female": {
      if (a.female === null) return false;
      if (!a.female.applies) return true;
      // 해당된다고 했으면 무엇이 해당되는지까지 골라야 한다.
      // "셋 다 해당사항 없음" 도 답이다
      if (a.female.checks.length === 0) return false;
      if (a.female.checks.includes(MENSTRUATION_ID)) {
        return a.female.menstrualDay !== null;
      }
      return true;
    }
  }
}

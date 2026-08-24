import type { ExamRuleset, NumberField, TimeCopy } from "./rules/types";

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
   * 금식 시작을 문답의 어제/오늘 + 시각으로 옮긴 값.
   *
   * 화면에 뜨는 `fastingStart` 와 **같은 항목에서 나온다.** 다시 계산하면
   * 환자가 읽은 시각과 비교 기준이 갈릴 수 있다.
   */
  fastingStartAt?: TimeAnswer;
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

export function buildQuestions(
  ruleset: ExamRuleset,
  hints: ScheduleHints = {},
): Question[] {
  const q = ruleset.questions;
  const diabetes = ruleset.conditional.find((c) => c.id === "diabetes");

  return [
    {
      id: "fasting",
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
      keptBefore: hints.fastingStartAt,
      // 되묻기는 기준 시각이 있을 때만 성립한다
      recheck: hints.fastingStartAt && hints.fastingStart
        ? {
            note: q.fasting.recheck_note.replace("{time}", hints.fastingStart),
            ask: q.fasting.recheck_ask,
            hint: itemsLine(q.fasting.recheck_hint, ruleset.fasting.forbidden),
            yesLabel: q.fasting.recheck_yes,
            noLabel: q.fasting.recheck_no,
          }
        : undefined,
    },
    {
      id: "diabetes",
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

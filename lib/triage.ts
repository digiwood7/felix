import type { Answers, TimeAnswer } from "./questions";
import { fillPhone } from "./reservationLabel";
import type {
  ExamRuleset,
  Level,
  LocationOption,
  TriageCondition,
} from "./rules/types";
import type { Reservation } from "./schedule";

/**
 * 배지 판정 — PRD §9.4
 *
 * 판정 순서
 *   1. flags 중 level:"call" 해당      → call
 *   2. triage 중 level:"call" 해당     → call
 *   3. flags 또는 triage 중 tell 해당  → tell
 *   4. 없으면                          → ok
 *
 * **이 파일에 검사별 조건문을 넣지 않는다.**
 * 여기 있는 것은 조건식(`when`)을 해석하는 방법뿐이고, 어떤 조건이
 * 어떤 등급인지는 전부 룰셋이 정한다. level 값은 W1 게이트에서 직원이
 * 확정하므로, 그때 코드가 아니라 JSON 한 줄만 바뀌어야 한다.
 *
 * triage 가 없는 룰셋도 정상 동작한다 (flags 만으로 판정).
 */

export interface Verdict {
  level: Level;
  /** 룰셋 levels 의 행동 지시. 판정문이 아니다 */
  message: string;
  /** 주의가 필요한 항목만. 카드 하단에 다시 모아 보여준다 */
  reasons: { label: string; level: Level }[];
}

export interface TriageInput {
  ruleset: ExamRuleset;
  answers: Answers;
  reservation: Reservation;
  /**
   * 선택한 건물. 접수처 연락처가 건물마다 다르므로 call 문구에 들어간다.
   *
   * 필수다. 번호를 모르는 채로 "전화해 주세요" 를 띄우면 그 문구가
   * 하는 일이 없어지고, 대표번호로 대신 안내하면 교환을 한 번 더 거친다.
   */
  location: LocationOption;
}

const ORDER: Record<Level, number> = { ok: 0, tell: 1, call: 2 };

export function triage(input: TriageInput): Verdict {
  const { ruleset, answers, location } = input;

  const reasons: { label: string; level: Level }[] = [];

  // flags — 환자가 스스로 아는 사실. 고른 순서가 아니라 룰셋 순서로 모은다
  for (const flag of ruleset.flags) {
    if (answers.female?.checks.includes(flag.id)) {
      reasons.push({ label: flag.q, level: flag.level });
    }
  }

  for (const rule of ruleset.triage ?? []) {
    if (matches(rule.when, input)) {
      reasons.push({ label: rule.label, level: rule.level });
    }
  }

  const level = reasons.reduce<Level>(
    (worst, r) => (ORDER[r.level] > ORDER[worst] ? r.level : worst),
    "ok",
  );

  return {
    level,
    message: fillPhone(ruleset.levels[level], location),
    // ok 인 항목은 "주의가 필요한 항목"이 아니다
    reasons: reasons.filter((r) => r.level !== "ok"),
  };
}

/**
 * 조건식 해석 — 코드가 아는 것은 이 목록뿐이다.
 *
 * 새 조건이 필요하면 TriageCondition 에 이름을 추가하고 여기에 해석을
 * 붙인다. 룰셋 JSON 에 조건을 늘려도 코드가 모르면 판정되지 않는다.
 */
function matches(when: TriageCondition, input: TriageInput): boolean {
  const { ruleset, answers } = input;

  switch (when) {
    /**
     * 금식 — 환자가 "지키지 못했다" 고 답한 그대로 받는다.
     *
     * 마지막 식사 시각으로 답을 뒤집지 않는다. 계산이 "실은 6시간을
     * 넘겼다" 고 말해도 tell 을 ok 로 내리지 않는다. 그 방향의 오류가
     * 이 서비스에서 가장 위험하다 — 커피 한 잔으로 금식이 깨졌는지는
     * 시계가 모르고 환자만 안다. 대신 **얼마나 모자라는지**로
     * tell 과 call 을 가르고, 그것을 잴 수 없으면 숫자를 말하지 않는다.
     *
     * 어긋난 답을 되묻는 것은 문답 화면이 한다 (QuestionFlow).
     * 여기서 추측하지 않는다.
     */
    /**
     * 못 지켰다고 답했는데 **부족분을 말할 수 없는** 상태.
     *
     * 시각을 답하지 않았거나(잴 수 없음), 답한 시각이 오히려 기준을
     * 넘겼거나(모자라지 않음) 둘 중 하나다. 어느 쪽이든 "몇 시간
     * 부족" 을 카드에 적으면 그건 사실이 아니다 — 어제 저녁이
     * 마지막이라고 답한 환자에게 "1시간 이내 부족" 이 붙는다.
     *
     * 등급은 내리지 않는다. 못 지켰다는 답 자체는 그대로 받는다.
     */
    case "fasting.short_unmeasured":
      return isBroken(answers) && fastingShortfall(input) === null;

    case "fasting.short": {
      const short = fastingShortfall(input);
      return (
        isBroken(answers) &&
        short !== null &&
        !overGrace(short, ruleset.fasting.grace_h)
      );
    }

    case "fasting.short_over_grace": {
      const short = fastingShortfall(input);
      return (
        isBroken(answers) &&
        short !== null &&
        overGrace(short, ruleset.fasting.grace_h)
      );
    }

    /**
     * 쓴다고 했는데 **얼마나 늦었는지 말할 수 없는** 상태.
     *
     * 시각을 답하지 않았거나, 표시된 마지노선은 넘겼지만 예약 기준
     * 4시간은 지킨 구간이다. 어느 쪽이든 "1시간 이내 초과" 는
     * 사실이 아니다. 등급은 내리지 않는다 — 화면이 안내한 시각을
     * 넘긴 것은 맞고, 시각을 모르는 것은 접수에서 물을 일이다.
     */
    case "diabetes.used_unmeasured":
      return usesDiabetes(input) && input.answers.diabetes?.time == null;

    case "diabetes.after_cutoff": {
      const excess = diabetesExcess(input);
      const rule = ruleset.conditional.find((c) => c.id === "diabetes");
      return (
        usesDiabetes(input) &&
        excess !== null &&
        !overGrace(excess, rule?.grace_h)
      );
    }

    case "diabetes.after_cutoff_over_grace": {
      const excess = diabetesExcess(input);
      const rule = ruleset.conditional.find((c) => c.id === "diabetes");
      return (
        usesDiabetes(input) &&
        excess !== null &&
        overGrace(excess, rule?.grace_h)
      );
    }

    case "weight.over_limit": {
      const limit = ruleset.questions.body.weight.limit;
      const weight = answers.body.weight;
      if (limit === undefined || weight === null) return false;
      return weight > limit;
    }
  }
}

function isBroken(answers: TriageInput["answers"]): boolean {
  return answers.fasting?.kept === false;
}

/**
 * 당뇨약 · 인슐린을 쓴다고 답했는가. 마지노선 판정의 전제다.
 *
 * 룰셋에 당뇨 규칙이 없으면 판정하지 않는다. 없는 기준으로 배지를
 * 올리면 전화가 걸려 오고, 그것이 줄이려던 바로 그 업무다.
 */
function usesDiabetes(input: TriageInput): boolean {
  if (input.answers.diabetes?.uses !== true) return false;
  return input.ruleset.conditional.some((c) => c.id === "diabetes");
}

/**
 * 마지노선을 얼마나 넘겼는지(분). 시각을 모르거나 넘기지 않았으면 null.
 *
 * **화면에 표시된 내림값이 아니라 예약 시각에서 잰다** — 걸러 낼지도,
 * 얼마나 늦었는지도 같은 자[尺]로 본다. 내림은 **안내를 이르게 하려고**
 * 있는 것이지 실무 기준을 앞당기는 것이 아니다. 표시값을 판정선으로
 * 쓰면 **정확히 4시간 전에 쓴 환자가 걸린다** — 17:30 예약의 13:30
 * 복용이 그랬다. 규칙을 지킨 환자를 접수로 보내면, 그 문답이 곧
 * 줄이려던 업무다.
 */
function diabetesExcess(input: TriageInput): number | null {
  const time = input.answers.diabetes?.time;
  const rule = input.ruleset.conditional.find((c) => c.id === "diabetes");
  if (!time || !rule) return null;
  const excess = Math.abs(rule.offset_h) * 60 - minutesBefore(input, time);
  return excess > 0 ? excess : null;
}

/**
 * 기준에서 얼마나 모자라는지(분).
 *
 * **화면에 표시된 내림값이 아니라 예약 시각에서 잰다.**
 * 표시값은 floor_hour 로 최대 59분 이르게 잡혀 있어서, 그 값을 기준으로
 * 허용 오차를 재면 같은 "3시간 전 복용" 이 예약 분에 따라 tell 이 됐다
 * call 이 됐다 한다. 실무의 기준은 "몇 시간 전이냐" 이므로 그쪽으로 잰다.
 *
 * 답이 없으면 null — 재지 못한 것은 초과로 치지 않는다.
 */
function fastingShortfall(input: TriageInput): number | null {
  const time = input.answers.fasting?.time;
  if (!time) return null;
  const short = input.ruleset.fasting.hours * 60 - minutesBefore(input, time);
  // 0 이하는 "모자라지 않았다" 다. 0 을 돌려주면 부족분 칸에 섞인다
  return short > 0 ? short : null;
}

/**
 * 허용 오차를 넘었는가.
 *
 * 오차를 정의하지 않은 룰셋이면 0으로 본다 — 기준에 못 미치는 순간
 * 상위 조건이 걸린다. 오차는 값이므로 코드가 아니라 룰셋이 정한다.
 */
function overGrace(shortfallMin: number, graceHours: number | undefined) {
  return shortfallMin > (graceHours ?? 0) * 60;
}

/** 예약 시각보다 얼마나 앞선 시각인지(분). 음수면 예약 이후다 */
function minutesBefore(input: TriageInput, time: TimeAnswer): number {
  const reservationEpoch = Date.UTC(
    input.reservation.year,
    input.reservation.month - 1,
    input.reservation.day,
    input.reservation.hour,
    input.reservation.minute,
  );
  const answerEpoch = Date.UTC(
    input.reservation.year,
    input.reservation.month - 1,
    input.reservation.day - (time.day === "yesterday" ? 1 : 0),
    time.hour,
    time.minute,
  );
  return (reservationEpoch - answerEpoch) / 60_000;
}

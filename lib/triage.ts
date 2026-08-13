import type { Answers, TimeAnswer } from "./questions";
import type { ExamRuleset, Level, TriageCondition } from "./rules/types";
import type { Reservation, Timeline } from "./schedule";

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
  timeline: Timeline;
}

const ORDER: Record<Level, number> = { ok: 0, tell: 1, call: 2 };

export function triage(input: TriageInput): Verdict {
  const { ruleset, answers } = input;

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
    message: ruleset.levels[level],
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
     * 환자가 "금식하지 않았다" 고 답한 그대로 받는다.
     *
     * 마지막 식사 시각을 금식 시작 시각과 견주어 뒤집지 않는다.
     * 환자의 답을 계산으로 덮으면 tell 이 ok 로 내려갈 수 있고,
     * 그 방향의 오류가 이 서비스에서 가장 위험하다. 시각은 카드에
     * 사실로 적어 접수 직원이 보게 한다.
     */
    case "fasting.broken":
      return answers.fasting?.kept === false;

    case "diabetes.after_cutoff": {
      if (answers.diabetes?.uses !== true) return false;
      const used = answers.diabetes.time;
      if (!used) return false;
      const cutoff = stampOf(input.timeline, "diabetes");
      // 마지노선을 못 구하면 판정하지 않는다. 없는 기준으로 call 을 띄우면
      // 전화가 걸려 오고, 그것이 줄이려던 바로 그 업무다
      if (!cutoff) return false;
      return stampOfAnswer(input.reservation, used) > cutoff;
    }

    case "weight.over_limit": {
      const limit = ruleset.questions.body.weight.limit;
      const weight = answers.body.weight;
      if (limit === undefined || weight === null) return false;
      return weight > limit;
    }
  }
}

/** 타임라인 항목의 "YYYY-MM-DD HH:MM". 사전순 비교가 곧 시각 비교가 된다 */
function stampOf(timeline: Timeline, id: string): string | null {
  for (const day of timeline) {
    const item = day.items.find((i) => i.id === id);
    if (item?.time) return `${day.date} ${item.time}`;
  }
  return null;
}

/**
 * 문답의 "어제/오늘 + 시각" 을 예약일 기준 절대 시각으로 바꾼다.
 *
 * KST 고정 규칙을 그대로 지킨다 — Date.UTC 와 getUTC* 만 쓰므로
 * 기기 타임존이 무엇이든 결과가 같다 (PRD §9.2).
 */
function stampOfAnswer(reservation: Reservation, time: TimeAnswer): string {
  const epoch = Date.UTC(
    reservation.year,
    reservation.month - 1,
    reservation.day - (time.day === "yesterday" ? 1 : 0),
  );
  const d = new Date(epoch);
  const pad = (n: number) => String(n).padStart(2, "0");
  const date = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  return `${date} ${pad(time.hour)}:${pad(time.minute)}`;
}

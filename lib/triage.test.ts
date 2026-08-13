import { describe, expect, it } from "vitest";

import { MENSTRUATION_ID, NONE_ID, emptyAnswers } from "./questions";
import type { Answers } from "./questions";
import { f18FdgPet } from "./rules";
import type { ExamRuleset } from "./rules/types";
import { buildTimeline } from "./schedule";
import type { Reservation } from "./schedule";
import { triage } from "./triage";

/**
 * 배지 판정 — PRD §9.4
 *
 * 여기서 잠그는 것은 두 가지다.
 *   1. 판정 순서 (call > tell > ok)
 *   2. **level 값이 룰셋에서만 온다는 것.** JSON 의 level 만 바꿔서
 *      배지가 따라 바뀌지 않으면, 어딘가에 하드코딩이 남아 있다는 뜻이다.
 */

// 8월 20일(목) 14:25 예약 → 금식 08:00, 당뇨 마지노선 10:00
const RESERVATION: Reservation = {
  year: 2026,
  month: 8,
  day: 20,
  hour: 14,
  minute: 25,
};

const TIMELINE = buildTimeline(f18FdgPet, {
  reservation: RESERVATION,
  locationId: "cancer",
});

function verdictOf(patch: Partial<Answers>, ruleset: ExamRuleset = f18FdgPet) {
  return triage({
    ruleset,
    answers: { ...emptyAnswers(), ...patch },
    reservation: RESERVATION,
    timeline: TIMELINE,
  });
}

/** 금식 지킴 · 당뇨 없음 · 정상 체중 · 여성 문항 해당 없음 */
const CLEAN: Partial<Answers> = {
  fasting: { kept: true, time: null },
  diabetes: { uses: false, time: null },
  body: { height: 172, weight: 68, unknown: false },
  female: { applies: false, checks: [], menstrualDay: null },
};

describe("배지 — 해당 없음", () => {
  it("아무 조건도 걸리지 않으면 ok", () => {
    const v = verdictOf(CLEAN);
    expect(v.level).toBe("ok");
    expect(v.message).toBe(f18FdgPet.levels.ok);
    expect(v.reasons).toEqual([]);
  });

  it("키 · 몸무게를 모른다고 해도 ok — 판정할 값이 없다", () => {
    const v = verdictOf({
      ...CLEAN,
      body: { height: null, weight: null, unknown: true },
    });
    expect(v.level).toBe("ok");
  });

  // 룰셋 flags 에 없는 id 이므로 배지에 영향을 주지 않는다
  it("셋 다 해당사항 없음은 배지를 올리지 않는다", () => {
    const v = verdictOf({
      ...CLEAN,
      female: { applies: true, checks: [NONE_ID], menstrualDay: null },
    });
    expect(v.level).toBe("ok");
  });
});

/**
 * 허용 오차 1시간 — 기준에 조금 못 미치는 것과 크게 못 미치는 것을 가른다.
 *
 * 예약이 14:25 이므로 기준은 이렇다.
 *   금식 6시간 → 08:25 이전 식사면 지킨 것. 07:25 까지는 1시간 부족
 *   당뇨 4시간 → 10:25 까지 사용. 11:25 까지는 1시간 초과
 *
 * **화면에 표시된 내림값(08:00 · 10:00)이 아니라 예약 시각에서 잰다.**
 * 표시값으로 재면 같은 "3시간 전 복용" 이 예약 분에 따라 tell 이 됐다
 * call 이 됐다 한다.
 */
describe("배지 — tell", () => {
  it("금식이 1시간 이내로 모자라면 tell — 5시간 금식", () => {
    const v = verdictOf({
      ...CLEAN,
      // 09:25 식사 → 5시간 금식 (1시간 부족)
      fasting: { kept: false, time: { day: "today", hour: 9, minute: 25 } },
    });
    expect(v.level).toBe("tell");
    expect(v.message).toBe(f18FdgPet.levels.tell);
    expect(v.reasons.map((r) => r.label)).toContain(
      "금식 시간 부족 (1시간 이내)",
    );
  });

  it("당뇨약을 1시간 이내로 늦게 썼으면 tell — 3시간 전 복용", () => {
    const v = verdictOf({
      ...CLEAN,
      // 11:25 사용 → 예약 3시간 전. 마지노선(4시간 전)보다 1시간 늦다
      diabetes: { uses: true, time: { day: "today", hour: 11, minute: 25 } },
    });
    expect(v.level).toBe("tell");
    expect(v.reasons.map((r) => r.label)).toContain(
      "당뇨약 마지노선 초과 (1시간 이내)",
    );
  });

  // 오차 "이내" 는 정확히 1시간을 포함한다. 경계에서 등급이 갈리지 않는다
  it("모자람이 정확히 1시간이면 아직 tell", () => {
    expect(
      verdictOf({
        ...CLEAN,
        fasting: { kept: false, time: { day: "today", hour: 9, minute: 25 } },
      }).level,
    ).toBe("tell");
    expect(
      verdictOf({
        ...CLEAN,
        diabetes: { uses: true, time: { day: "today", hour: 11, minute: 25 } },
      }).level,
    ).toBe("tell");
  });

  it("생리 중이면 tell — 룰셋 flags 의 level 을 그대로 쓴다", () => {
    const v = verdictOf({
      ...CLEAN,
      female: {
        applies: true,
        checks: [MENSTRUATION_ID],
        menstrualDay: 2,
      },
    });
    expect(v.level).toBe("tell");
  });

  /**
   * 환자가 "금식하지 않았다" 고 답했으면 그대로 받는다.
   * 시각을 계산과 견주어 tell 을 ok 로 내리지 않는다 —
   * 그 방향의 오류가 이 서비스에서 가장 위험하다.
   */
  it("마지막 식사가 금식 시작 전이어도 답을 뒤집지 않는다", () => {
    const v = verdictOf({
      ...CLEAN,
      // 금식 시작은 08:00. 어제 21:30 은 그보다 이르다
      fasting: {
        kept: false,
        time: { day: "yesterday", hour: 21, minute: 30 },
      },
    });
    expect(v.level).toBe("tell");
  });
});

describe("배지 — call", () => {
  it("체중이 상한을 넘으면 call", () => {
    const v = verdictOf({
      ...CLEAN,
      body: { height: 175, weight: 141, unknown: false },
    });
    expect(v.level).toBe("call");
    expect(v.message).toBe(f18FdgPet.levels.call);
  });

  it("상한과 같은 값은 call 이 아니다 — 초과부터다", () => {
    const v = verdictOf({
      ...CLEAN,
      body: { height: 175, weight: 140, unknown: false },
    });
    expect(v.level).toBe("ok");
  });

  it("임신 가능성은 call", () => {
    const v = verdictOf({
      ...CLEAN,
      female: { applies: true, checks: ["pregnancy"], menstrualDay: null },
    });
    expect(v.level).toBe("call");
  });

  it("금식이 1시간 넘게 모자라면 call — 4시간 금식", () => {
    const v = verdictOf({
      ...CLEAN,
      // 10:25 식사 → 4시간 금식 (2시간 부족)
      fasting: { kept: false, time: { day: "today", hour: 10, minute: 25 } },
    });
    expect(v.level).toBe("call");
    expect(v.reasons.map((r) => r.label)).toContain(
      "금식 시간 부족 (1시간 초과)",
    );
  });

  it("당뇨약을 1시간 넘게 늦게 썼으면 call — 2시간 전 복용", () => {
    const v = verdictOf({
      ...CLEAN,
      diabetes: { uses: true, time: { day: "today", hour: 12, minute: 25 } },
    });
    expect(v.level).toBe("call");
    expect(v.reasons.map((r) => r.label)).toContain(
      "당뇨약 마지노선 초과 (1시간 넘음)",
    );
  });

  // 1분만 넘어도 등급이 올라간다. 오차는 오차일 뿐 또 하나의 기준이 아니다
  it("오차를 1분이라도 넘으면 call", () => {
    expect(
      verdictOf({
        ...CLEAN,
        fasting: { kept: false, time: { day: "today", hour: 9, minute: 26 } },
      }).level,
    ).toBe("call");
    expect(
      verdictOf({
        ...CLEAN,
        diabetes: { uses: true, time: { day: "today", hour: 11, minute: 26 } },
      }).level,
    ).toBe("call");
  });

  it("마지노선 전에 썼으면 걸리지 않는다", () => {
    const v = verdictOf({
      ...CLEAN,
      diabetes: { uses: true, time: { day: "today", hour: 8, minute: 0 } },
    });
    expect(v.level).toBe("ok");
  });

  it("전날에 썼으면 걸리지 않는다", () => {
    const v = verdictOf({
      ...CLEAN,
      diabetes: { uses: true, time: { day: "yesterday", hour: 22, minute: 0 } },
    });
    expect(v.level).toBe("ok");
  });

  // 마지노선 정각은 "이후" 가 아니다. 룰셋이 "이 시각까지만" 이라고 말한다
  it("마지노선 정각은 걸리지 않는다", () => {
    const v = verdictOf({
      ...CLEAN,
      diabetes: { uses: true, time: { day: "today", hour: 10, minute: 0 } },
    });
    expect(v.level).toBe("ok");
  });

  it("call 과 tell 이 함께면 call 이 이긴다", () => {
    const v = verdictOf({
      ...CLEAN,
      // 금식은 1시간 이내 부족(tell), 체중은 상한 초과(call)
      fasting: { kept: false, time: { day: "today", hour: 9, minute: 25 } },
      body: { height: 175, weight: 150, unknown: false },
    });
    expect(v.level).toBe("call");
    expect(v.reasons).toHaveLength(2);
  });

  // 같은 항목이 tell 과 call 을 동시에 걸면 카드에 두 줄이 뜬다
  it("한 항목이 두 등급으로 동시에 걸리지 않는다", () => {
    const v = verdictOf({
      ...CLEAN,
      fasting: { kept: false, time: { day: "today", hour: 10, minute: 25 } },
      diabetes: { uses: true, time: { day: "today", hour: 12, minute: 25 } },
    });
    expect(v.reasons).toHaveLength(2);
  });
});

/**
 * T7 DoD — 하드코딩이 남아 있지 않다는 증거.
 * JSON 의 level 만 바꿨을 때 배지가 따라 바뀌어야 한다.
 */
describe("판정은 룰셋에서만 온다", () => {
  it("triage level 을 tell → ok 로 내리면 배지가 내려간다", () => {
    const lowered: ExamRuleset = {
      ...f18FdgPet,
      triage: f18FdgPet.triage!.map((r) =>
        r.when === "fasting.short" ? { ...r, level: "ok" as const } : r,
      ),
    };
    const answers: Partial<Answers> = {
      ...CLEAN,
      fasting: { kept: false, time: { day: "today", hour: 9, minute: 25 } },
    };

    expect(verdictOf(answers).level).toBe("tell");
    expect(verdictOf(answers, lowered).level).toBe("ok");
  });

  it("flag level 을 call → tell 로 내리면 배지가 내려간다", () => {
    const lowered: ExamRuleset = {
      ...f18FdgPet,
      flags: f18FdgPet.flags.map((f) =>
        f.id === "pregnancy" ? { ...f, level: "tell" as const } : f,
      ),
    };
    const answers: Partial<Answers> = {
      ...CLEAN,
      female: { applies: true, checks: ["pregnancy"], menstrualDay: null },
    };

    expect(verdictOf(answers).level).toBe("call");
    expect(verdictOf(answers, lowered).level).toBe("tell");
  });

  // 검사 종류를 늘릴 때 triage 없는 룰셋도 동작해야 한다 (PRD §9.4)
  it("triage 가 없어도 flags 만으로 판정한다", () => {
    const noTriage: ExamRuleset = { ...f18FdgPet, triage: undefined };

    expect(
      verdictOf(
        {
          ...CLEAN,
          fasting: { kept: false, time: { day: "today", hour: 7, minute: 0 } },
        },
        noTriage,
      ).level,
    ).toBe("ok");

    expect(
      verdictOf(
        {
          ...CLEAN,
          female: { applies: true, checks: ["lactation"], menstrualDay: null },
        },
        noTriage,
      ).level,
    ).toBe("call");
  });

  it("문구는 룰셋 levels 를 그대로 쓴다", () => {
    for (const [level, patch] of [
      ["ok", CLEAN],
      [
        "tell",
        {
          ...CLEAN,
          fasting: { kept: false, time: { day: "today", hour: 7, minute: 0 } },
        },
      ],
      [
        "call",
        { ...CLEAN, body: { height: 175, weight: 200, unknown: false } },
      ],
    ] as const) {
      expect(verdictOf(patch).message).toBe(
        f18FdgPet.levels[level as "ok" | "tell" | "call"],
      );
    }
  });
});

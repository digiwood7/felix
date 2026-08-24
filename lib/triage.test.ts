import { describe, expect, it } from "vitest";

import { MENSTRUATION_ID, NONE_ID, emptyAnswers } from "./questions";
import type { Answers } from "./questions";
import { fillPhone } from "./reservationLabel";
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


/** 건물은 필수 입력이다 */
const locationOf = (id: string) =>
  f18FdgPet.locations.options.find((o) => o.id === id)!;

const TIMELINE = buildTimeline(f18FdgPet, {
  reservation: RESERVATION,
  location: locationOf("cancer"),
});

function verdictOf(
  patch: Partial<Answers>,
  ruleset: ExamRuleset = f18FdgPet,
  locationId = "cancer",
) {
  return triage({
    ruleset,
    answers: { ...emptyAnswers(), ...patch },
    reservation: RESERVATION,
    timeline: TIMELINE,
    location: locationOf(locationId),
  });
}

/** 룰셋 문구에 그 건물 연락처를 넣은 것. 기대값을 손으로 적지 않는다 */
function messageOf(level: "ok" | "tell" | "call", locationId = "cancer") {
  return fillPhone(f18FdgPet.levels[level], locationOf(locationId));
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

  /**
   * 부족분을 말할 수 없는 두 경우는 숫자를 붙이지 않는다.
   *
   * 20시간을 굶은 환자에게 "1시간 이내 부족" 이 붙으면 카드가
   * 직원에게 틀린 말을 하는 것이다. 등급은 그대로 tell 이다 —
   * 못 지켰다는 답 자체는 받는다.
   */
  it("답한 시각이 오히려 금식을 지킨 시각이면 부족분을 말하지 않는다", () => {
    const v = verdictOf({
      ...CLEAN,
      fasting: {
        kept: false,
        time: { day: "yesterday", hour: 21, minute: 30 },
      },
    });
    expect(v.level).toBe("tell");
    expect(v.reasons.map((r) => r.label)).toEqual(["금식 여부 확인 필요"]);
  });

  it("마지막 식사 시각을 답하지 않아도 부족분을 말하지 않는다", () => {
    const v = verdictOf({
      ...CLEAN,
      fasting: { kept: false, time: null },
    });
    expect(v.level).toBe("tell");
    expect(v.reasons.map((r) => r.label)).toEqual(["금식 여부 확인 필요"]);
  });

  it("금식 시작 정각에 먹었으면 부족분이 0 이므로 숫자를 말하지 않는다", () => {
    const v = verdictOf({
      ...CLEAN,
      // 금식 시작 08:00 정각 — 모자라지 않았다
      fasting: { kept: false, time: { day: "today", hour: 8, minute: 25 } },
    });
    expect(v.level).toBe("tell");
    expect(v.reasons.map((r) => r.label)).toEqual(["금식 여부 확인 필요"]);
  });

  it("1분이라도 모자라면 부족분을 말한다", () => {
    const v = verdictOf({
      ...CLEAN,
      fasting: { kept: false, time: { day: "today", hour: 8, minute: 26 } },
    });
    expect(v.level).toBe("tell");
    expect(v.reasons.map((r) => r.label)).toEqual([
      "금식 시간 부족 (1시간 이내)",
    ]);
  });

  /**
   * 당뇨약도 같은 규칙이다 — 걸러 낸 이유와 재는 자가 다르다.
   *
   * 걸러 내는 기준은 **화면에 안내한 마지노선**(내림된 10:00)이고,
   * 얼마나 늦었는지는 **예약 시각**에서 잰다 (실무 기준이 "몇 시간
   * 전이냐" 이므로). 그래서 표시값은 넘겼지만 4시간은 지킨 구간이
   * 생긴다. 그 구간에 "1시간 이내 초과" 를 적으면 사실이 아니다.
   */
  it("표시된 마지노선은 넘겼지만 4시간을 지켰으면 초과분을 말하지 않는다", () => {
    const v = verdictOf({
      ...CLEAN,
      // 마지노선 표시는 10:00, 예약 기준 4시간 지점은 10:25.
      // 10:10 은 표시값은 넘겼지만 예약 기준으로는 4시간 15분 전이다
      diabetes: { uses: true, time: { day: "today", hour: 10, minute: 10 } },
    });
    expect(v.level).toBe("tell");
    expect(v.reasons.map((r) => r.label)).toEqual(["당뇨약 사용 시각 확인 필요"]);
  });

  it("예약 기준 4시간 정각도 초과분이 0 이므로 숫자를 말하지 않는다", () => {
    const v = verdictOf({
      ...CLEAN,
      diabetes: { uses: true, time: { day: "today", hour: 10, minute: 25 } },
    });
    expect(v.level).toBe("tell");
    expect(v.reasons.map((r) => r.label)).toEqual(["당뇨약 사용 시각 확인 필요"]);
  });

  it("1분이라도 늦으면 초과분을 말한다", () => {
    const v = verdictOf({
      ...CLEAN,
      diabetes: { uses: true, time: { day: "today", hour: 10, minute: 26 } },
    });
    expect(v.level).toBe("tell");
    expect(v.reasons.map((r) => r.label)).toEqual([
      "당뇨약 마지노선 초과 (1시간 이내)",
    ]);
  });

  /**
   * **쓴다고 했는데 시각을 모르면 넘기지 않는다.**
   *
   * 화면은 시각을 답해야 다음으로 보내지만, 주소가 잘려 오면 이 상태로
   * 카드가 열린다. 그때 🟢 를 띄우면 "당뇨약 쓰신다" 는 답을 받아 두고
   * 아무 말도 하지 않는 카드가 된다 — 금식 쪽과 방향이 반대가 된다.
   */
  it("당뇨약을 쓴다고 했는데 시각을 답하지 않으면 tell", () => {
    const v = verdictOf({
      ...CLEAN,
      diabetes: { uses: true, time: null },
    });
    expect(v.level).toBe("tell");
    expect(v.reasons.map((r) => r.label)).toEqual(["당뇨약 사용 시각 확인 필요"]);
  });

  it("마지노선 정각까지는 아무 말도 하지 않는다", () => {
    const v = verdictOf({
      ...CLEAN,
      diabetes: { uses: true, time: { day: "today", hour: 10, minute: 0 } },
    });
    expect(v.level).toBe("ok");
    expect(v.reasons).toEqual([]);
  });

  it("당뇨약 세 갈래도 서로 겹치지 않는다", () => {
    for (const time of [
      null,
      { day: "today", hour: 10, minute: 10 } as const,
      { day: "today", hour: 10, minute: 26 } as const,
      { day: "today", hour: 11, minute: 25 } as const,
      { day: "today", hour: 12, minute: 25 } as const,
    ]) {
      const v = verdictOf({ ...CLEAN, diabetes: { uses: true, time } });
      expect(v.reasons).toHaveLength(1);
    }
  });

  it("세 갈래는 서로 겹치지 않는다 — 사유는 언제나 한 줄이다", () => {
    for (const time of [
      null,
      { day: "yesterday", hour: 21, minute: 30 } as const,
      { day: "today", hour: 8, minute: 25 } as const,
      { day: "today", hour: 9, minute: 25 } as const,
      { day: "today", hour: 10, minute: 25 } as const,
    ]) {
      const v = verdictOf({ ...CLEAN, fasting: { kept: false, time } });
      expect(v.reasons).toHaveLength(1);
    }
  });
});

describe("배지 — call", () => {
  it("체중이 상한을 넘으면 call", () => {
    const v = verdictOf({
      ...CLEAN,
      body: { height: 175, weight: 151, unknown: false },
    });
    expect(v.level).toBe("call");
    expect(v.message).toBe(messageOf("call"));
  });

  it("상한과 같은 값은 call 이 아니다 — 초과부터다", () => {
    const v = verdictOf({
      ...CLEAN,
      body: { height: 175, weight: 150, unknown: false },
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
      body: { height: 175, weight: 160, unknown: false },
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
        messageOf(level as "ok" | "tell" | "call"),
      );
    }
  });
});

/**
 * 접수처 연락처는 건물마다 다르다.
 *
 * 대표번호로 안내하면 환자가 교환을 거쳐 다시 연결되고, 줄이려던
 * 전화 응대가 오히려 두 번 일어난다. 번호는 룰셋 locations 에서 온다 —
 * 여기에 건물 이름으로 분기하는 코드가 생기면 검사 확장이 막힌다.
 */
describe("배지 — 건물별 연락처", () => {
  const OVER_LIMIT: Partial<Answers> = {
    ...CLEAN,
    body: { height: 175, weight: 151, unknown: false },
  };

  /**
   * 화면에 나가는 붙임표는 줄바꿈 없는 것(U+2011)이다 — 번호가 줄 끝에서
   * 갈라지면 잘못 눌러 다른 곳으로 전화가 간다. 기대값은 보통 붙임표로
   * 적고 여기서 되돌려 비교한다.
   */
  function phoneIn(locationId = "cancer") {
    return verdictOf(OVER_LIMIT, f18FdgPet, locationId).message.replaceAll(
      "‑",
      "-",
    );
  }

  it("본관을 고르면 본관 번호로 안내한다", () => {
    expect(phoneIn("main")).toContain("02)3410-2620");
  });

  it("암병원을 고르면 암병원 번호로 안내한다", () => {
    expect(phoneIn("cancer")).toContain("02)3410-2622");
  });

  // 대체 번호를 두지 않는다. 건물이 없으면 화면 자체가 그려지지 않는다
  it("두 건물 중 하나의 번호만 나온다", () => {
    const phones = f18FdgPet.locations.options.map((o) => o.phone);
    expect(phones).toContain(phoneIn("main").match(/02\)[\d-]+/)?.[0]);
    expect(phoneIn("cancer")).not.toContain("1599");
  });

  // 줄 끝에서 갈라지면 잘못 눌러 다른 곳으로 전화가 간다
  it("번호 안 붙임표는 줄바꿈되지 않는 글자다", () => {
    expect(verdictOf(OVER_LIMIT, f18FdgPet, "main").message).not.toContain("-");
  });

  // 자리표시자가 그대로 화면에 나가는 것이 이 변경의 유일한 실패 모드다
  // 모르는 건물은 여기까지 오지 못한다 — 주소를 읽는 문에서 걸러지고
  // (lib/searchParam.ts), 걸러지면 화면이 S1 으로 되돌아간다
  it("문구에 자리표시자가 남지 않는다", () => {
    for (const option of f18FdgPet.locations.options) {
      const message = verdictOf(OVER_LIMIT, f18FdgPet, option.id).message;
      expect(message).not.toContain("{phone}");
      expect(message).not.toContain("(으)로");
    }
  });

  /**
   * 조사는 앞 숫자를 읽은 소리를 따른다.
   *   2620 → "공" 으로 끝나 받침이 있다 → 으로
   *   2622 → "이" 로 끝나 받침이 없다  → 로
   */
  it("조사가 번호 끝소리를 따른다", () => {
    expect(verdictOf(OVER_LIMIT, f18FdgPet, "main").message).toContain(
      "2620으로",
    );
    expect(verdictOf(OVER_LIMIT, f18FdgPet, "cancer").message).toContain(
      "2622로",
    );
  });
});

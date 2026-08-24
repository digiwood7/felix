import { describe, expect, it } from "vitest";

import {
  MENSTRUATION_ID,
  NONE_ID,
  atOrBefore,
  buildQuestions,
  emptyAnswers,
  isAnswered,
  relativeTimeOf,
  type Answers,
} from "./questions";
import { f18FdgPet } from "./rules";

const HINTS = {
  fastingStart: "8월 20일(목) 02:00",
  diabetesCutoff: "8월 20일(목) 04:00",
};

describe("문항 구성", () => {
  it("접수에서 반복되는 4가지만 묻는다", () => {
    expect(buildQuestions(f18FdgPet).map((q) => q.id)).toEqual([
      "fasting",
      "diabetes",
      "body",
      "female",
    ]);
  });

  it("문구는 룰셋에서 온다", () => {
    const [fasting, diabetes, body, female] = buildQuestions(f18FdgPet);
    expect(fasting.title).toBe(f18FdgPet.questions.fasting.ask);
    expect(diabetes.title).toBe(
      f18FdgPet.conditional.find((c) => c.id === "diabetes")!.ask,
    );
    expect(body.title).toBe(f18FdgPet.questions.body.ask);
    expect(female.title).toBe(f18FdgPet.questions.female.ask);
  });

  // 6시간이 몇 시부터인지는 서비스가 이미 계산해 두었다.
  // 그 시각을 같이 보여 주면 환자가 뺄셈을 하지 않아도 된다
  it("금식 문항에 계산된 시작 시각이 붙는다", () => {
    const [fasting] = buildQuestions(f18FdgPet, HINTS);
    expect(fasting.title).toContain("6시간");
    expect(fasting.hint).toContain("8월 20일(목) 02:00");
    expect(fasting.hint).toContain("물(생수)");
  });

  // 화면마다 자리가 바뀌면 잘못 누른다
  it("두 갈래 문항은 왼쪽이 언제나 긍정이다", () => {
    for (const q of buildQuestions(f18FdgPet)) {
      if (q.id === "body") continue;
      expect(["네", "예"]).toContain(q.yesLabel);
      expect(["아니요", "아니오"]).toContain(q.noLabel);
    }
  });

  it("당뇨 문항에 계산된 마지노선이 붙는다", () => {
    const diabetes = buildQuestions(f18FdgPet, HINTS)[1];
    expect(diabetes.hint).toContain("8월 20일(목) 04:00");
  });

  // 시각을 못 구해도 화면은 떠야 한다
  it("시각 없이도 문항이 만들어진다", () => {
    const questions = buildQuestions(f18FdgPet);
    expect(questions).toHaveLength(4);
    expect(questions[1].hint).toBeUndefined();
  });

  it("여성 문항의 선택지는 룰셋 flags 에서 온다", () => {
    const female = buildQuestions(f18FdgPet)[3];
    expect(female.options?.map((o) => o.id)).toEqual(
      f18FdgPet.flags.map((f) => f.id),
    );
  });
});

describe("다음으로 넘어갈 수 있는지", () => {
  const [fasting, diabetes, body, female] = buildQuestions(f18FdgPet);

  function answers(patch: Partial<Answers>): Answers {
    return { ...emptyAnswers(), ...patch };
  }

  it("아무것도 고르지 않으면 넘어가지 못한다", () => {
    const empty = emptyAnswers();
    for (const q of [fasting, diabetes, body, female]) {
      expect(isAnswered(q, empty)).toBe(false);
    }
  });

  it("금식 — 지켰다고 하면 바로 넘어간다", () => {
    expect(
      isAnswered(fasting, answers({ fasting: { kept: true, time: null } })),
    ).toBe(true);
  });

  // 기본값을 채워 두면 환자가 고르지 않은 시각으로 금식 위반이 판정된다
  it("금식 — 못 지켰으면 시각까지 골라야 넘어간다", () => {
    expect(
      isAnswered(fasting, answers({ fasting: { kept: false, time: null } })),
    ).toBe(false);
    expect(
      isAnswered(
        fasting,
        answers({
          fasting: { kept: false, time: { day: "today", hour: 7, minute: 0 } },
        }),
      ),
    ).toBe(true);
  });

  it("당뇨 — 쓴다고만 하고 시각을 안 고르면 넘어가지 못한다", () => {
    expect(
      isAnswered(diabetes, answers({ diabetes: { uses: true, time: null } })),
    ).toBe(false);
    expect(
      isAnswered(diabetes, answers({ diabetes: { uses: false, time: null } })),
    ).toBe(true);
  });

  it("키 · 몸무게 — 둘 다 채워야 넘어간다", () => {
    expect(
      isAnswered(
        body,
        answers({ body: { height: 172, weight: null, unknown: false } }),
      ),
    ).toBe(false);
    expect(
      isAnswered(
        body,
        answers({ body: { height: 172, weight: 68, unknown: false } }),
      ),
    ).toBe(true);
  });

  // 억지로 채우게 하면 어림값이 들어오고, 그 값으로 체중 상한 판정이 돌아간다
  it("키 · 몸무게 — 모른다고 하면 넘어간다", () => {
    expect(
      isAnswered(
        body,
        answers({ body: { height: null, weight: null, unknown: true } }),
      ),
    ).toBe(true);
  });

  it("키 · 몸무게 — 범위를 벗어난 값은 답이 아니다", () => {
    expect(
      isAnswered(
        body,
        answers({ body: { height: 5, weight: 68, unknown: false } }),
      ),
    ).toBe(false);
    expect(
      isAnswered(
        body,
        answers({ body: { height: 172, weight: 999, unknown: false } }),
      ),
    ).toBe(false);
  });

  it("여성 — 해당 없으면 바로 넘어간다", () => {
    expect(
      isAnswered(
        female,
        answers({ female: { applies: false, checks: [], menstrualDay: null } }),
      ),
    ).toBe(true);
  });

  // "안 물어봤다" 와 "물어봤고 해당 없다" 는 접수 직원에게 다른 정보다
  it("여성 — 해당되면 무엇이 해당되는지까지 골라야 한다", () => {
    expect(
      isAnswered(
        female,
        answers({ female: { applies: true, checks: [], menstrualDay: null } }),
      ),
    ).toBe(false);
    expect(
      isAnswered(
        female,
        answers({
          female: { applies: true, checks: [NONE_ID], menstrualDay: null },
        }),
      ),
    ).toBe(true);
  });

  it("여성 — 생리를 고르면 며칠째인지까지 골라야 한다", () => {
    expect(
      isAnswered(
        female,
        answers({
          female: {
            applies: true,
            checks: [MENSTRUATION_ID],
            menstrualDay: null,
          },
        }),
      ),
    ).toBe(false);
    expect(
      isAnswered(
        female,
        answers({
          female: { applies: true, checks: [MENSTRUATION_ID], menstrualDay: 2 },
        }),
      ),
    ).toBe(true);
  });

  // 룰셋 flags 에 없는 id 이므로 배지 판정에는 걸리지 않는다
  it("해당사항 없음은 룰셋 flags 와 겹치지 않는다", () => {
    expect(f18FdgPet.flags.map((f) => f.id)).not.toContain(NONE_ID);
  });
});

/**
 * 어긋난 답을 되묻는 기준 — PRD §8 F2
 *
 * "못 지켰다" 고 답했는데 고른 시각이 오히려 금식을 지킨 시각이면
 * 화면이 한 번 되묻는다. 그 판단에 쓰는 두 함수다.
 */
describe("금식 되묻기 기준", () => {
  it("예약 당일과 전날만 상대 시각으로 옮긴다", () => {
    expect(relativeTimeOf("2026-08-20", "08:00", "2026-08-20")).toEqual({
      day: "today",
      hour: 8,
      minute: 0,
    });
    expect(relativeTimeOf("2026-08-19", "21:00", "2026-08-20")).toEqual({
      day: "yesterday",
      hour: 21,
      minute: 0,
    });
  });

  it("월 · 연 경계를 넘어도 전날은 전날이다", () => {
    expect(relativeTimeOf("2026-07-31", "23:00", "2026-08-01")).toEqual({
      day: "yesterday",
      hour: 23,
      minute: 0,
    });
    expect(relativeTimeOf("2025-12-31", "18:00", "2026-01-01")).toEqual({
      day: "yesterday",
      hour: 18,
      minute: 0,
    });
    // 윤년 2월 29일
    expect(relativeTimeOf("2028-02-29", "20:00", "2028-03-01")).toEqual({
      day: "yesterday",
      hour: 20,
      minute: 0,
    });
  });

  /**
   * 이틀 전이 나오면 되묻지 않는다. 문답의 시각 선택지가 어제 · 오늘
   * 둘뿐이라, 그보다 이른 기준과는 비교 자체가 성립하지 않는다.
   */
  it("이틀 이상 전이면 기준을 만들지 않는다", () => {
    expect(relativeTimeOf("2026-08-18", "08:00", "2026-08-20")).toBeUndefined();
    expect(relativeTimeOf("2026-08-21", "08:00", "2026-08-20")).toBeUndefined();
  });

  it("어제는 오늘보다 언제나 앞이다", () => {
    const 오늘0시 = { day: "today", hour: 0, minute: 0 } as const;
    const 어제23시59분 = { day: "yesterday", hour: 23, minute: 59 } as const;
    expect(atOrBefore(어제23시59분, 오늘0시)).toBe(true);
    expect(atOrBefore(오늘0시, 어제23시59분)).toBe(false);
  });

  it("같은 시각은 지킨 것으로 본다 — 정각까지가 금식 시작이다", () => {
    const 기준 = { day: "today", hour: 8, minute: 0 } as const;
    expect(atOrBefore({ day: "today", hour: 8, minute: 0 }, 기준)).toBe(true);
    expect(atOrBefore({ day: "today", hour: 7, minute: 59 }, 기준)).toBe(true);
    expect(atOrBefore({ day: "today", hour: 8, minute: 1 }, 기준)).toBe(false);
  });

  it("기준 시각이 없으면 되묻기 문구를 만들지 않는다", () => {
    const [fasting] = buildQuestions(f18FdgPet);
    expect(fasting.recheck).toBeUndefined();
    expect(fasting.keptBefore).toBeUndefined();
  });

  it("문구는 룰셋에서 읽고 금식 시작 시각을 채워 넣는다", () => {
    const [fasting] = buildQuestions(f18FdgPet, {
      ...HINTS,
      fastingStartAt: { day: "today", hour: 2, minute: 0 },
    });
    expect(fasting.recheck?.note).toContain("8월 20일(목) 02:00");
    expect(fasting.recheck?.note).not.toContain("{time}");
    // 금지 품목이 문구에 그대로 들어간다 — 커피 한 잔도 금식을 깬다
    expect(fasting.recheck?.hint).toContain("커피");
    expect(fasting.recheck?.hint).not.toContain("{items}");
  });
});

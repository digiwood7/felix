import { describe, expect, it } from "vitest";

import {
  allowedCodes,
  answerCodes,
  distanceOf,
  sanitizePayload,
  toLoggedEvent,
} from "./logEvent";
import { emptyAnswers, type Answers } from "./questions";
import { f18FdgPet } from "./rules";

/**
 * 익명 로그 — PRD §8 F4
 *
 * 여기서 지키는 것은 두 가지다.
 *   담기지 말아야 할 것이 담기지 않는가
 *   열린 엔드포인트가 모르는 값을 통과시키지 않는가
 */

/** 예약일 2026-08-06 08:25 기준으로 그날 아침 09:00 KST */
const EXAM_DATE = "2026-08-06";
const EXAM_DAY_MORNING = Date.parse("2026-08-06T00:00:00Z"); // KST 09:00

describe("distanceOf — 예약일까지의 거리", () => {
  it.each([
    ["2026-08-06", "D-0"],
    ["2026-08-07", "D-1"],
    ["2026-08-08", "D-2"],
    ["2026-08-09", "D-3"],
    ["2026-08-10", "D-4~7"],
    ["2026-08-13", "D-4~7"],
    ["2026-08-14", "D-8+"],
    ["2026-09-30", "D-8+"],
    ["2026-08-05", "past"],
  ])("%s → %s", (date, expected) => {
    expect(distanceOf(date, EXAM_DAY_MORNING)).toBe(expected);
  });

  /**
   * 기기 타임존이 개입하면 자정 언저리에 D-0 과 D-1 이 섞인다.
   * KST 로 2026-08-06 23:30 (UTC 14:30) 은 어느 나라에서 열어도 D-0 이다.
   */
  it("기기 타임존과 무관하다", () => {
    const kstLateNight = Date.parse("2026-08-06T14:30:00Z");
    expect(distanceOf(EXAM_DATE, kstLateNight)).toBe("D-0");
  });
});

describe("answerCodes — 담기는 것과 담기지 않는 것", () => {
  it("키 · 몸무게 숫자를 담지 않는다", () => {
    const answers: Answers = {
      ...emptyAnswers(),
      body: { height: 173, weight: 88, unknown: false },
    };

    const codes = answerCodes(f18FdgPet, answers);

    expect(codes).toContain("body:known");
    // 숫자가 어떤 형태로도 새어 나가면 안 된다
    expect(JSON.stringify(codes)).not.toContain("173");
    expect(JSON.stringify(codes)).not.toContain("88");
  });

  it("모른다고 답한 것과 답하지 않은 것을 구분한다", () => {
    const unknown: Answers = {
      ...emptyAnswers(),
      body: { height: null, weight: null, unknown: true },
    };
    expect(answerCodes(f18FdgPet, unknown)).toContain("body:unknown");

    // 아직 답하지 않았으면 코드를 만들지 않는다
    expect(answerCodes(f18FdgPet, emptyAnswers())).toEqual([]);
  });

  it("금식 · 당뇨는 답한 그대로 갈린다", () => {
    const answers: Answers = {
      ...emptyAnswers(),
      fasting: { kept: false, time: { day: "today", hour: 6, minute: 0 } },
      diabetes: { uses: true, time: { day: "today", hour: 6, minute: 30 } },
    };

    const codes = answerCodes(f18FdgPet, answers);

    expect(codes).toContain("fasting:broken");
    expect(codes).toContain("diabetes:used");
    // 마지막으로 드신 시각은 담지 않는다 — 담을 이유가 없다
    expect(JSON.stringify(codes)).not.toContain("6");
  });

  it("여성 문항은 룰셋 flags 의 id 를 그대로 쓴다", () => {
    const answers: Answers = {
      ...emptyAnswers(),
      female: {
        applies: true,
        checks: ["menstruation"],
        menstrualDay: 3,
      },
    };

    const codes = answerCodes(f18FdgPet, answers);

    expect(codes).toContain("female:menstruation");
    // 생리 일수는 담지 않는다
    expect(codes).not.toContain("3");
  });

  it("해당 없음과 셋 다 아님을 구분한다", () => {
    const na: Answers = {
      ...emptyAnswers(),
      female: { applies: false, checks: [], menstrualDay: null },
    };
    expect(answerCodes(f18FdgPet, na)).toContain("female:na");

    const none: Answers = {
      ...emptyAnswers(),
      female: { applies: true, checks: ["none"], menstrualDay: null },
    };
    expect(answerCodes(f18FdgPet, none)).toContain("female:none");
  });

  it("룰셋이 모르는 코드는 만들어져도 걸러진다", () => {
    const answers: Answers = {
      ...emptyAnswers(),
      female: { applies: true, checks: ["made_up"], menstrualDay: null },
    };
    expect(answerCodes(f18FdgPet, answers)).toEqual([]);
  });
});

describe("allowedCodes — 룰셋이 정한다", () => {
  it("flags 가 늘면 코드도 늘어난다", () => {
    const allowed = allowedCodes(f18FdgPet);
    for (const flag of f18FdgPet.flags) {
      expect(allowed.has(`female:${flag.id}`)).toBe(true);
    }
  });
});

describe("sanitizePayload — 아는 값만 통과시킨다", () => {
  it("제 형태면 통과한다", () => {
    expect(
      sanitizePayload(f18FdgPet, {
        screen: "s4",
        rel: "D-0",
        badge: "tell",
        answers: ["fasting:broken", "female:menstruation"],
      }),
    ).toEqual({
      screen: "s4",
      rel: "D-0",
      badge: "tell",
      answers: ["fasting:broken", "female:menstruation"],
    });
  });

  it("null 은 답하지 않은 것으로 받는다", () => {
    expect(
      sanitizePayload(f18FdgPet, { screen: "s1", rel: null, badge: null }),
    ).toEqual({ screen: "s1", rel: null, badge: null, answers: null });
  });

  it.each([
    ["모르는 화면", { screen: "s9" }],
    ["화면이 없음", { rel: "D-0" }],
    ["화면이 문자열이 아님", { screen: 4 }],
    ["모르는 거리", { screen: "s2", rel: "D-99" }],
    ["모르는 배지", { screen: "s4", badge: "fine" }],
    ["배열이 아닌 응답", { screen: "s4", answers: "fasting:kept" }],
    ["모르는 응답 코드", { screen: "s4", answers: ["med_bp"] }],
    ["응답에 섞인 원문", { screen: "s4", answers: ["홍길동"] }],
    ["코드가 너무 많음", { screen: "s4", answers: Array(9).fill("body:known") }],
    ["객체가 아님", "s4"],
    ["배열", ["s4"]],
    ["null", null],
  ])("%s → 통째로 버린다", (_label, raw) => {
    expect(sanitizePayload(f18FdgPet, raw)).toBeNull();
  });

  it("모르는 키는 실려 오더라도 담기지 않는다", () => {
    const payload = sanitizePayload(f18FdgPet, {
      screen: "s2",
      rel: "D-1",
      badge: null,
      answers: null,
      // 이런 것이 섞여 들어와도 저장 대상이 아니다
      name: "홍길동",
      ua: "Mozilla/5.0",
      t: "202608060825",
    });

    expect(payload).toEqual({
      screen: "s2",
      rel: "D-1",
      badge: null,
      answers: null,
    });
    expect(JSON.stringify(payload)).not.toContain("홍길동");
    expect(JSON.stringify(payload)).not.toContain("202608060825");
  });

  it("같은 코드를 반복해 분포를 부풀리지 못한다", () => {
    const payload = sanitizePayload(f18FdgPet, {
      screen: "s4",
      answers: ["fasting:broken", "fasting:broken", "fasting:broken"],
    });

    expect(payload?.answers).toEqual(["fasting:broken"]);
  });
});

describe("toLoggedEvent — 진입 시각은 서버가 찍는다", () => {
  it("KST 날짜와 시간대만 남고 분 이하는 버려진다", () => {
    // UTC 2026-08-06 05:47 = KST 14:47
    const now = Date.parse("2026-08-06T05:47:31Z");
    const event = toLoggedEvent(
      { screen: "s2", rel: "D-0", badge: null, answers: null },
      now,
    );

    expect(event.d).toBe("2026-08-06");
    expect(event.h).toBe(14);
    expect(JSON.stringify(event)).not.toContain("47");
  });

  it("자정 직후도 KST 로 읽는다", () => {
    // UTC 2026-08-05 15:10 = KST 2026-08-06 00:10
    const now = Date.parse("2026-08-05T15:10:00Z");
    const event = toLoggedEvent(
      { screen: "s1", rel: null, badge: null, answers: null },
      now,
    );

    expect(event.d).toBe("2026-08-06");
    expect(event.h).toBe(0);
  });
});

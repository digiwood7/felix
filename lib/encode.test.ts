import { describe, expect, it } from "vitest";

import type { StoredAnswers } from "./answers";
import {
  FORMAT_VERSION,
  answersHash,
  decodeAnswers,
  decodeAnswersFromHash,
  encodeAnswers,
} from "./encode";
import type { Answers } from "./questions";
import { NONE_ID, emptyAnswers } from "./questions";
import { f18FdgPet } from "./rules";

/**
 * URL 상태 인코딩 — PRD §8 F3 · §12
 *
 * 여기서 잠그는 것은 세 가지다.
 *   1. 넣은 것이 그대로 나온다 (다른 기기에서 같은 카드가 그려진다)
 *   2. 주소에 한글 원문이 실리지 않는다 (PRD §14)
 *   3. **어떻게 망가뜨려도 던지지 않는다.** 주소는 사람이 고칠 수 있고
 *      메신저가 끝을 잘라 먹기도 한다
 */

function storedOf(patch: Partial<Answers>, savedOn = "2026-08-20"): StoredAnswers {
  return { savedOn, answers: { ...emptyAnswers(), ...patch } };
}

const FULL = storedOf({
  fasting: { kept: false, time: { day: "yesterday", hour: 21, minute: 0 } },
  diabetes: { uses: true, time: { day: "today", hour: 9, minute: 30 } },
  body: { height: 168, weight: 62, unknown: false },
  female: {
    applies: true,
    checks: ["pregnancy", "menstruation"],
    menstrualDay: 4,
  },
});

function roundTrip(stored: StoredAnswers) {
  return decodeAnswers(f18FdgPet, encodeAnswers(f18FdgPet, stored));
}

describe("인코딩 — 넣은 것이 그대로 나온다", () => {
  it("네 문항을 모두 답한 카드", () => {
    expect(roundTrip(FULL)).toEqual(FULL);
  });

  it("금식을 지키고 나머지도 해당 없는 카드", () => {
    const stored = storedOf({
      fasting: { kept: true, time: null },
      diabetes: { uses: false, time: null },
      body: { height: 172, weight: 68, unknown: false },
      female: { applies: false, checks: [], menstrualDay: null },
    });
    expect(roundTrip(stored)).toEqual(stored);
  });

  /**
   * 몸무게 62.5 는 사람이 실제로 적는 값이다.
   *
   * 칸을 `.` 으로 나누면 `168.62.5` 가 되어 세 토막으로 읽히고 주소가
   * 통째로 버려진다. **만든 사람 화면에는 카드가 멀쩡히 보이는데
   * 받은 사람만 빈 화면을 본다** — 만든 사람은 끝까지 모른다.
   */
  it("소수점이 붙은 키 · 몸무게", () => {
    for (const body of [
      { height: 168, weight: 62.5, unknown: false },
      { height: 168.5, weight: 62, unknown: false },
      { height: 172.4, weight: 68.25, unknown: false },
    ]) {
      const stored = storedOf({ body });
      expect(roundTrip(stored)).toEqual(stored);
    }
  });

  /**
   * 잴 수 없는 값은 답으로 적지 않는다.
   *
   * 특히 음수를 그대로 적으면 `-5` 의 앞글자가 칸 구분자와 겹쳐 주소가
   * 한 칸 늘어나고, 주소 전체를 못 쓰게 만든다.
   */
  it("NaN · 무한대 · 음수는 답이 아니라 빈 값으로 적힌다", () => {
    for (const weight of [NaN, Infinity, -5, 0]) {
      const stored = storedOf({ body: { height: 168, weight, unknown: false } });
      const encoded = encodeAnswers(f18FdgPet, stored);

      expect(encoded).not.toContain("NaN");
      expect(encoded).not.toContain("Infinity");
      expect(encoded.split("-")).toHaveLength(6);

      expect(decodeAnswers(f18FdgPet, encoded)?.answers.body).toEqual({
        height: null,
        weight: null,
        unknown: false,
      });
    }
  });

  it("키 · 몸무게를 모른다고 답한 카드", () => {
    const stored = storedOf({
      fasting: { kept: true, time: null },
      body: { height: null, weight: null, unknown: true },
    });
    expect(roundTrip(stored)).toEqual(stored);
  });

  it("셋 다 해당사항 없음", () => {
    const stored = storedOf({
      female: { applies: true, checks: [NONE_ID], menstrualDay: null },
    });
    expect(roundTrip(stored)).toEqual(stored);
  });

  // "안 물어봤다" 와 "물어봤고 해당 없다" 는 직원에게 다른 정보다
  it("아무것도 답하지 않은 상태도 그대로 돌아온다", () => {
    const stored = storedOf({});
    expect(roundTrip(stored)).toEqual(stored);
  });

  it("생리를 골랐지만 일수를 고르기 전", () => {
    const stored = storedOf({
      female: { applies: true, checks: ["menstruation"], menstrualDay: null },
    });
    expect(roundTrip(stored)).toEqual(stored);
  });

  it("고른 순서가 달라도 같은 답으로 읽힌다", () => {
    const a = roundTrip(
      storedOf({
        female: {
          applies: true,
          checks: ["menstruation", "pregnancy"],
          menstrualDay: 2,
        },
      }),
    );
    const b = roundTrip(
      storedOf({
        female: {
          applies: true,
          checks: ["pregnancy", "menstruation"],
          menstrualDay: 2,
        },
      }),
    );
    expect(a).toEqual(b);
  });

  it("답한 날짜가 그대로 실린다 — 검사 당일 답인지 가리는 값이다", () => {
    const stored = storedOf({ fasting: { kept: true, time: null } }, "2026-08-17");
    expect(roundTrip(stored)?.savedOn).toBe("2026-08-17");
  });

  it("연말 · 윤년 날짜도 그대로", () => {
    for (const date of ["2026-12-31", "2028-02-29", "2027-01-01"]) {
      expect(roundTrip(storedOf({}, date))?.savedOn).toBe(date);
    }
  });
});

describe("인코딩 — 주소에 실려도 되는 문자열인가", () => {
  const encoded = encodeAnswers(f18FdgPet, FULL);

  // 자유 입력이 없으므로 원문이 생길 수 없다. 그것을 눈으로 확인한다
  it("한글이 들어 있지 않다", () => {
    expect(encoded).not.toMatch(/[가-힣]/);
  });

  it("이름 · 등록번호를 담을 자리가 없다 — 숫자와 정해진 기호뿐", () => {
    expect(encoded).toMatch(/^[0-9a-z._-]+$/);
  });

  it("주소에 그대로 실린다 — 이스케이프가 필요 없다", () => {
    expect(encodeURIComponent(encoded)).toBe(encoded);
  });

  // 카톡으로 보내는 링크다. 길면 잘리거나 두 줄이 된다
  it("가장 긴 답도 40자를 넘지 않는다", () => {
    expect(encoded.length).toBeLessThanOrEqual(40);
  });
});

describe("인코딩 — 망가진 주소", () => {
  const encoded = encodeAnswers(f18FdgPet, FULL);

  it("빈 값 · 없는 값은 null", () => {
    expect(decodeAnswers(f18FdgPet, undefined)).toBeNull();
    expect(decodeAnswers(f18FdgPet, null)).toBeNull();
    expect(decodeAnswers(f18FdgPet, "")).toBeNull();
  });

  /**
   * 자리 뜻이 바뀌었는데 옛 주소를 읽으면 **틀린 카드가 조용히 그려진다.**
   * 버리면 다시 답하게 될 뿐이다.
   */
  it("모르는 형식 판은 통째로 버린다", () => {
    expect(decodeAnswers(f18FdgPet, encoded.replace(/^1/, "2"))).toBeNull();
    expect(decodeAnswers(f18FdgPet, encoded.replace(/^1/, ""))).toBeNull();
  });

  it("칸 수가 다르면 null", () => {
    expect(decodeAnswers(f18FdgPet, "1-20260820-y-n-168.62")).toBeNull();
    expect(decodeAnswers(f18FdgPet, `${encoded}-x`)).toBeNull();
  });

  it("없는 날짜는 null", () => {
    for (const bad of ["20260230", "20261301", "2026082", "abcdefgh"]) {
      expect(decodeAnswers(f18FdgPet, `1-${bad}-y-n--`)).toBeNull();
    }
  });

  it("범위를 벗어난 키 · 몸무게는 null", () => {
    expect(decodeAnswers(f18FdgPet, "1-20260820-y-n-99x62-")).toBeNull();
    expect(decodeAnswers(f18FdgPet, "1-20260820-y-n-168x999-")).toBeNull();
    expect(decodeAnswers(f18FdgPet, "1-20260820-y-n-168-")).toBeNull();
  });

  // 같은 수를 여러 방식으로 적으면 같은 답이 다른 주소를 갖는다
  it("숫자를 적는 방식이 하나뿐이다", () => {
    for (const bad of ["0168x62", "1.68e2x62", "+168x62", "168x62.", "168x.62"]) {
      expect(decodeAnswers(f18FdgPet, `1-20260820-y-n-${bad}-`)).toBeNull();
    }
  });

  /**
   * 글자가 아닌 값이 들어온다.
   *
   * `?a=1&a=2` 처럼 같은 이름이 두 번 오면 Next 는 배열을 준다. 문자열로
   * 믿고 자르면 그 자리에서 500 이 뜨고, 접수 창구에 흰 화면이 뜬다.
   */
  it("글자가 아니면 던지지 않고 null", () => {
    for (const bad of [
      ["1-20260820-y-n--", "x"],
      [],
      123,
      {},
      true,
      Symbol("a"),
    ]) {
      expect(() => decodeAnswers(f18FdgPet, bad)).not.toThrow();
      expect(decodeAnswers(f18FdgPet, bad)).toBeNull();
    }
  });

  it("있을 수 없는 시각은 null", () => {
    expect(decodeAnswers(f18FdgPet, "1-20260820-n12500-n--")).toBeNull();
    expect(decodeAnswers(f18FdgPet, "1-20260820-n10999-n--")).toBeNull();
    expect(decodeAnswers(f18FdgPet, "1-20260820-n2100-n--")).toBeNull();
  });

  it("룰셋에 없는 항목 번호는 null", () => {
    expect(decodeAnswers(f18FdgPet, "1-20260820-y-n--y9")).toBeNull();
  });

  it("같은 항목을 두 번 고른 주소는 null", () => {
    expect(decodeAnswers(f18FdgPet, "1-20260820-y-n--y00")).toBeNull();
  });

  // 생리를 고르지 않았는데 일수가 붙어 있으면 어딘가 어긋난 것이다
  it("일수만 붙어 있으면 null", () => {
    expect(decodeAnswers(f18FdgPet, "1-20260820-y-n--y0.3")).toBeNull();
    expect(decodeAnswers(f18FdgPet, "1-20260820-y-n--y2.9")).toBeNull();
  });

  /**
   * 한 글자씩 지우고 바꿔 본다.
   *
   * 결과는 둘 중 하나여야 한다 — null 이거나, 온전한 답이거나.
   * **던지는 것은 어떤 경우에도 안 된다.** 카드 화면은 접수 창구에서
   * 열리고, 거기서 흰 화면이 뜨면 이 서비스는 그날로 끝난다.
   */
  it("한 글자를 지우거나 바꿔도 던지지 않는다", () => {
    for (let i = 0; i < encoded.length; i++) {
      const cut = encoded.slice(0, i) + encoded.slice(i + 1);
      const swapped = encoded.slice(0, i) + "z" + encoded.slice(i + 1);
      const chopped = encoded.slice(0, i);

      for (const bad of [cut, swapped, chopped]) {
        expect(() => decodeAnswers(f18FdgPet, bad)).not.toThrow();
        const result = decodeAnswers(f18FdgPet, bad);
        if (result !== null) {
          expect(result.savedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        }
      }
    }
  });

  it("사람이 아무렇게나 친 값에도 던지지 않는다", () => {
    const junk = [
      "1",
      "-----",
      "1-----",
      "1-20260820-y-n-168.62-y02.4-extra",
      "%%%",
      "1-20260820-yyyyy-nnnnn-...-...",
      "1".repeat(500),
      `1-20260820-y-n-168.62-y${"0".repeat(100)}`,
    ];
    for (const bad of junk) {
      expect(() => decodeAnswers(f18FdgPet, bad)).not.toThrow();
    }
  });
});

/**
 * 답은 물음표가 아니라 우물정 뒤에 붙는다.
 *
 * 우물정 뒤는 브라우저가 서버로 보내지 않는다. 물음표 뒤에 두면 카드를
 * 열 때마다 키 · 몸무게 · 임신 여부가 액세스 로그에 남는다.
 */
describe("인코딩 — 주소 조각", () => {
  it("우물정으로 시작한다", () => {
    expect(answersHash(f18FdgPet, FULL)).toMatch(/^#a=/);
  });

  it("조각을 그대로 넣으면 답이 돌아온다", () => {
    const hash = answersHash(f18FdgPet, FULL);
    expect(decodeAnswersFromHash(f18FdgPet, hash)).toEqual(FULL);
  });

  it("앞의 우물정이 없어도 읽는다", () => {
    const hash = answersHash(f18FdgPet, FULL).slice(1);
    expect(decodeAnswersFromHash(f18FdgPet, hash)).toEqual(FULL);
  });

  // 메신저가 주소를 손대면 퍼센트 인코딩이 섞여 들어온다
  it("퍼센트 인코딩이 섞여도 읽는다", () => {
    const encoded = encodeAnswers(f18FdgPet, FULL);
    expect(
      decodeAnswersFromHash(f18FdgPet, `#a=${encodeURIComponent(encoded)}`),
    ).toEqual(FULL);
  });

  it("조각이 없거나 다른 이름이면 null", () => {
    for (const bad of [
      "",
      "#",
      "#b=1-20260820-y-n--",
      "1-20260820-y-n--",
      undefined,
      null,
      ["#a=1-20260820-y-n--"],
    ]) {
      expect(() => decodeAnswersFromHash(f18FdgPet, bad)).not.toThrow();
      expect(decodeAnswersFromHash(f18FdgPet, bad)).toBeNull();
    }
  });

  // `%` 가 깨진 채로 오면 decodeURIComponent 가 던진다
  it("깨진 퍼센트 기호에도 던지지 않는다", () => {
    for (const bad of ["#a=%", "#a=%zz", "#a=1-2026%-y-n--"]) {
      expect(() => decodeAnswersFromHash(f18FdgPet, bad)).not.toThrow();
    }
  });
});

/**
 * 항목 번호는 룰셋 flags 의 **자리**를 가리킨다.
 *
 * 순서가 바뀌면 이미 카톡으로 보낸 주소가 다른 항목으로 읽힌다.
 * "임신 가능성" 이 "생리 중" 으로 읽히는 식이다. 그래서 flags 를 건드리면
 * 이 테스트가 먼저 멈추고, 형식 판을 올릴지 정하게 만든다.
 */
describe("인코딩 — 형식 판과 룰셋의 관계", () => {
  it("flags 순서가 바뀌면 형식 판을 올려야 한다", () => {
    expect(f18FdgPet.flags.map((f) => f.id)).toEqual([
      "pregnancy",
      "lactation",
      "menstruation",
    ]);
    expect(FORMAT_VERSION).toBe("1");
  });

  it("항목 번호는 룰셋에서 읽는다 — 코드에 이름이 박혀 있지 않다", () => {
    const reordered = {
      ...f18FdgPet,
      flags: [...f18FdgPet.flags].reverse(),
    };
    const stored = storedOf({
      female: { applies: true, checks: ["pregnancy"], menstrualDay: null },
    });

    // 같은 답이라도 룰셋 순서가 다르면 다른 자리번호로 적힌다
    expect(encodeAnswers(reordered, stored)).not.toBe(
      encodeAnswers(f18FdgPet, stored),
    );
    // 각자의 룰셋으로 읽으면 둘 다 원래 답으로 돌아온다
    expect(decodeAnswers(reordered, encodeAnswers(reordered, stored))).toEqual(
      stored,
    );
  });
});

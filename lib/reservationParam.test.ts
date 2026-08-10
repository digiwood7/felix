import { describe, expect, it } from "vitest";

import {
  formatReservationParam,
  parseReservationParam,
} from "./reservationParam";

describe("parseReservationParam", () => {
  it("정상 값을 읽는다", () => {
    expect(parseReservationParam("202608060825")).toEqual({
      year: 2026,
      month: 8,
      day: 6,
      hour: 8,
      minute: 25,
    });
  });

  it("자정을 읽는다", () => {
    expect(parseReservationParam("202608060000")).toEqual({
      year: 2026,
      month: 8,
      day: 6,
      hour: 0,
      minute: 0,
    });
  });

  it("윤년 2월 29일을 읽는다", () => {
    expect(parseReservationParam("202802291400")).not.toBeNull();
  });
});

/**
 * 잘못된 URL 로 진입해도 크래시하지 않는다.
 * 카톡으로 링크가 돌아다니다 잘리거나, 손으로 고쳐 들어올 수 있다.
 */
describe("parseReservationParam — 잘못된 값은 전부 null", () => {
  it.each([
    ["없음", undefined],
    ["빈 문자열", ""],
    ["짧음", "2026080608"],
    ["김", "2026080608250"],
    ["숫자 아님", "20260806082a"],
    ["공백 포함", "2026 806 825"],
    ["13월", "202613060825"],
    ["0월", "202600060825"],
    ["24시", "202608062425"],
    ["60분", "202608060860"],
    ["2월 30일", "202602300825"],
    ["평년 2월 29일", "202602290825"],
    ["4월 31일", "202604310825"],
    ["0일", "202608000825"],
    ["스크립트", "<script>"],
  ])("%s", (_label, value) => {
    expect(parseReservationParam(value)).toBeNull();
  });
});

describe("formatReservationParam", () => {
  it("한 자리 값을 0으로 채운다", () => {
    expect(
      formatReservationParam({
        year: 2026,
        month: 1,
        day: 2,
        hour: 3,
        minute: 4,
      }),
    ).toBe("202601020304");
  });

  it("왕복해도 값이 유지된다", () => {
    for (const raw of ["202608060825", "202701010030", "202802291400"]) {
      expect(formatReservationParam(parseReservationParam(raw)!)).toBe(raw);
    }
  });
});

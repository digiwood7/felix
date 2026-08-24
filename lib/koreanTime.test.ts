import { describe, expect, it } from "vitest";

import {
  daysUntilInKST,
  isBeforeInKST,
  toDateTimeAttr,
  toKoreanDateLabel,
  toKoreanTimeLabel,
  todayInKST,
} from "./koreanTime";

describe("toKoreanTimeLabel", () => {
  it.each([
    ["00:00", "오전 12시"],
    ["00:30", "오전 12시 30분"],
    ["02:00", "오전 2시"],
    ["08:00", "오전 8시"],
    ["08:25", "오전 8시 25분"],
    ["11:59", "오전 11시 59분"],
    ["12:00", "오후 12시"],
    ["12:30", "오후 12시 30분"],
    ["13:00", "오후 1시"],
    ["18:00", "오후 6시"],
    ["21:00", "오후 9시"],
    ["23:59", "오후 11시 59분"],
  ])("%s → %s", (time, expected) => {
    expect(toKoreanTimeLabel(time)).toBe(expected);
  });

  it("정각이면 분을 읽지 않는다", () => {
    expect(toKoreanTimeLabel("04:00")).not.toContain("분");
  });
});

describe("toDateTimeAttr", () => {
  it("시각이 있으면 합친다", () => {
    expect(toDateTimeAttr("2026-08-06", "02:00")).toBe("2026-08-06T02:00");
  });

  it("종일 항목은 날짜만 쓴다", () => {
    expect(toDateTimeAttr("2026-08-05", null)).toBe("2026-08-05");
  });
});

describe("toKoreanDateLabel", () => {
  it("앞의 0을 떼고 읽는다", () => {
    expect(toKoreanDateLabel("2026-08-06")).toBe("8월 6일");
    expect(toKoreanDateLabel("2026-12-31")).toBe("12월 31일");
    expect(toKoreanDateLabel("2027-01-01")).toBe("1월 1일");
  });
});

/**
 * "오늘" 은 계산이 아니라 화면 강조에만 쓴다. 그래도 KST 고정은 지킨다 —
 * 기기 타임존에 따라 하루가 밀리면 검사 당일에 문답을 권하지 못한다.
 */
describe("todayInKST", () => {
  const at = (iso: string) => Date.parse(iso);

  it("UTC 자정 직후는 KST 로 이미 오전 9시, 같은 날이다", () => {
    expect(todayInKST(at("2026-08-20T00:10:00Z"))).toBe("2026-08-20");
  });

  // UTC 15:00 = KST 자정. 여기서 날짜가 넘어간다
  it("UTC 14:59 는 아직 어제, 15:00 부터 다음 날이다", () => {
    expect(todayInKST(at("2026-08-20T14:59:00Z"))).toBe("2026-08-20");
    expect(todayInKST(at("2026-08-20T15:00:00Z"))).toBe("2026-08-21");
  });

  it("월말 · 연말을 넘긴다", () => {
    expect(todayInKST(at("2026-08-31T15:00:00Z"))).toBe("2026-09-01");
    expect(todayInKST(at("2026-12-31T15:00:00Z"))).toBe("2027-01-01");
  });

  it("윤년 2월 29일을 넘긴다", () => {
    expect(todayInKST(at("2028-02-28T15:00:00Z"))).toBe("2028-02-29");
  });
});

describe("daysUntilInKST", () => {
  const now = Date.parse("2026-08-20T01:00:00Z"); // KST 8월 20일 오전 10시

  it("오늘이면 0", () => {
    expect(daysUntilInKST("2026-08-20", now)).toBe(0);
  });

  it("내일이면 1, 어제면 -1", () => {
    expect(daysUntilInKST("2026-08-21", now)).toBe(1);
    expect(daysUntilInKST("2026-08-19", now)).toBe(-1);
  });

  it("달을 넘겨도 날수로 센다", () => {
    expect(daysUntilInKST("2026-09-01", now)).toBe(12);
  });

  // 서머타임이 있는 지역에서 실행해도 날수가 어긋나면 안 된다
  it("자정 직전에도 오늘은 오늘이다", () => {
    const almostMidnight = Date.parse("2026-08-20T14:59:00Z");
    expect(daysUntilInKST("2026-08-20", almostMidnight)).toBe(0);
  });
});

/**
 * 금식이 아직 시작되지 않았는지 가리는 데 쓴다 (S2 CheckCta).
 *
 * 17:30 예약이면 금식 시작이 11:00 인데, 앱은 "검사 당일 아침에
 * 답해 주세요" 라고 권한다. 아침 8시에 답하면 "6시간 금식 하셨나요?" 가
 * **아직 일어나지 않은 일을 묻게 된다.** 그 상태를 가려낸다.
 */
describe("isBeforeInKST", () => {
  // KST 8월 24일 오전 8시
  const 아침 = Date.parse("2026-08-23T23:00:00Z");

  it("금식 시작 전이면 true", () => {
    expect(isBeforeInKST("2026-08-24", "11:00", 아침)).toBe(true);
  });

  it("금식 시작을 지났으면 false", () => {
    // KST 8월 24일 오후 12시
    const 낮 = Date.parse("2026-08-24T03:00:00Z");
    expect(isBeforeInKST("2026-08-24", "11:00", 낮)).toBe(false);
  });

  // 정각은 "시작됐다" 로 본다. 그 시각부터 금식이므로 답할 수 있다
  it("정각은 이르지 않다", () => {
    const 정각 = Date.parse("2026-08-24T02:00:00Z"); // KST 11:00
    expect(isBeforeInKST("2026-08-24", "11:00", 정각)).toBe(false);
  });

  it("1분 차이도 가른다", () => {
    const 직전 = Date.parse("2026-08-24T01:59:00Z"); // KST 10:59
    expect(isBeforeInKST("2026-08-24", "11:00", 직전)).toBe(true);
  });

  // 금식 시작이 전날인 새벽 예약. 검사 당일이 되면 이미 지난 것이다
  it("전날 시각은 당일이 되면 지난 것이다", () => {
    const 당일새벽 = Date.parse("2026-08-23T16:00:00Z"); // KST 8월 24일 01:00
    expect(isBeforeInKST("2026-08-23", "23:00", 당일새벽)).toBe(false);
  });

  // 자정을 넘기는 경계. 기기 타임존이 무엇이든 KST 로만 판단해야 한다
  it("KST 자정 직후에도 날짜 비교가 맞다", () => {
    const 자정직후 = Date.parse("2026-08-23T15:01:00Z"); // KST 8월 24일 00:01
    expect(isBeforeInKST("2026-08-24", "02:00", 자정직후)).toBe(true);
    expect(isBeforeInKST("2026-08-23", "23:00", 자정직후)).toBe(false);
  });
});

import { describe, expect, it } from "vitest";

import {
  toDateTimeAttr,
  toKoreanDateLabel,
  toKoreanTimeLabel,
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

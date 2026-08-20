import { describe, expect, it } from "vitest";

import {
  formatLocation,
  formatReservationDate,
  formatReservationTime,
  formatReservationTimeKorean,
} from "./reservationLabel";
import { f18FdgPet } from "./rules";
import type { Reservation } from "./schedule";

function at(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): Reservation {
  return { year, month, day, hour, minute };
}

describe("formatReservationDate", () => {
  it("요일까지 붙여 쓴다", () => {
    // 2026-08-06 은 목요일
    expect(formatReservationDate(at(2026, 8, 6, 8, 25))).toBe(
      "2026년 8월 6일 (목)",
    );
  });

  it("월말 · 연말을 넘겨도 요일이 맞는다", () => {
    expect(formatReservationDate(at(2026, 1, 1, 0, 30))).toBe(
      "2026년 1월 1일 (목)",
    );
  });

  it("윤년 2월 29일의 요일이 맞는다", () => {
    expect(formatReservationDate(at(2028, 2, 29, 14, 0))).toBe(
      "2028년 2월 29일 (화)",
    );
  });

  it("기기 타임존이 달라도 요일이 밀리지 않는다", () => {
    // 로컬 타임존을 따르는 API 를 쓰면 UTC-5 에서 하루 앞으로 밀린다.
    // 여기서는 프로세스 타임존이 무엇이든 결과가 같아야 한다 (PRD §9.2)
    const label = formatReservationDate(at(2026, 8, 6, 0, 0));
    expect(label).toBe("2026년 8월 6일 (목)");
  });
});

describe("formatReservationTime", () => {
  it("두 자리로 채운다", () => {
    expect(formatReservationTime(at(2026, 8, 6, 8, 25))).toBe("08:25");
    expect(formatReservationTime(at(2026, 8, 6, 14, 0))).toBe("14:00");
  });
});

describe("formatReservationTimeKorean", () => {
  it("오전과 오후를 가른다", () => {
    expect(formatReservationTimeKorean(at(2026, 8, 6, 8, 25))).toBe(
      "오전 8시 25분",
    );
    expect(formatReservationTimeKorean(at(2026, 8, 6, 14, 25))).toBe(
      "오후 2시 25분",
    );
  });

  it("정각이면 분을 말하지 않는다", () => {
    expect(formatReservationTimeKorean(at(2026, 8, 6, 14, 0))).toBe("오후 2시");
  });

  it("정오와 자정을 12시로 쓴다", () => {
    expect(formatReservationTimeKorean(at(2026, 8, 6, 12, 0))).toBe(
      "오후 12시",
    );
    expect(formatReservationTimeKorean(at(2026, 8, 6, 0, 30))).toBe(
      "오전 12시 30분",
    );
  });
});

describe("formatLocation", () => {
  // 건물을 모르는 경우가 없다 — 해석은 주소를 읽는 문에서 한 번만 하고
  // (lib/searchParam.ts), 통과하지 못하면 화면이 그려지지 않는다
  it("룰셋의 건물 문구를 읽는다", () => {
    const locationOf = (id: string) =>
      f18FdgPet.locations.options.find((o) => o.id === id)!;
    expect(formatLocation(locationOf("main"))).toBe("본관 지하 1층 핵의학과");
    expect(formatLocation(locationOf("cancer"))).toBe(
      "암병원 지하 1층 핵의학과",
    );
  });
});

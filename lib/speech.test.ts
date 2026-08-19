import { describe, expect, it } from "vitest";

import { f18FdgPet } from "./rules";
import { buildTimeline } from "./schedule";
import type { Reservation } from "./schedule";
import { speechScript } from "./speech";

/**
 * 읽어주기 원고 — PRD §8 F3
 *
 * 잠그는 것은 하나다. **화면과 같은 것을 같은 순서로 읽는다.**
 * 옆에서 듣는 보호자가 화면을 함께 보고 있는데 다른 말이 나오면,
 * 어느 쪽이 맞는지 확인하려고 결국 전화를 건다.
 */

const RESERVATION: Reservation = {
  year: 2026,
  month: 8,
  day: 20,
  hour: 8,
  minute: 25,
};

function scriptOf(reservation: Reservation = RESERVATION, locationId = "main") {
  return speechScript(
    f18FdgPet,
    buildTimeline(f18FdgPet, { reservation, locationId }),
  );
}

describe("읽어주기 — 내용", () => {
  const script = scriptOf();

  it("첫머리 안내로 시작한다 — 무엇을 듣고 있는지 먼저 말한다", () => {
    expect(script.startsWith(f18FdgPet.intro)).toBe(true);
  });

  it("날짜와 요일을 말한다", () => {
    expect(script).toContain("8월 19일 수요일");
    expect(script).toContain("8월 20일 목요일");
  });

  // "02:00" 을 그대로 읽히면 "영이 콜론 영영" 이 된다
  it("시각을 사람이 말하는 형태로 읽는다", () => {
    expect(script).toContain("오전 2시");
    expect(script).toContain("오전 8시");
    expect(script).not.toContain("02:00");
    expect(script).not.toMatch(/\d{2}:\d{2}/);
  });

  it("종일 항목은 시각 대신 하루 종일이라고 말한다", () => {
    expect(script).toContain("하루 종일");
  });

  it("지시문과 보조 설명을 모두 읽는다", () => {
    expect(script).toContain(f18FdgPet.fasting.text);
    expect(script).toContain("물(생수)만 가능합니다");
    expect(script).toContain("접수 시 혈당을 측정합니다");
  });

  it("건물이 룰셋에서 읽혀 나온다", () => {
    expect(scriptOf(RESERVATION, "cancer")).toContain("암병원 지하 1층");
    expect(scriptOf(RESERVATION, "main")).toContain("본관 지하 1층");
  });

  // 듣기만 하는 사람에게도 닿아야 한다
  it("Disclaimer 로 끝난다", () => {
    expect(script).toContain("병원 공식 서비스가 아니며");
    expect(script.trimEnd().endsWith("핵의학과 직원에게 받으세요.")).toBe(true);
  });

  it("화면과 같은 순서다 — 금식이 도착보다 먼저 나온다", () => {
    expect(script.indexOf("드시지 마세요")).toBeLessThan(
      script.indexOf("핵의학과 도착"),
    );
  });
});

describe("읽어주기 — 소리로 낼 수 있는 형태", () => {
  const script = scriptOf();

  // 읽지 못하거나 "가운뎃점" 이라고 읽는다
  it("가운뎃점이 남아 있지 않다", () => {
    expect(script).not.toContain("·");
  });

  it("줄표가 남아 있지 않다", () => {
    expect(script).not.toContain("—");
  });

  /**
   * 마침표가 없으면 다음 도막과 이어 붙어 한 문장처럼 흘러간다.
   * 숨 쉴 곳이 없으면 고령 사용자는 중간부터 놓친다.
   */
  it("도막마다 마침표로 끊긴다", () => {
    const sentences = script.split(". ").filter(Boolean);
    expect(sentences.length).toBeGreaterThan(10);
    for (const sentence of sentences) {
      expect(sentence.trim()).not.toBe("");
    }
  });

  it("빈 도막이 이어져 마침표만 나오는 자리가 없다", () => {
    expect(script).not.toContain("..");
    expect(script).not.toMatch(/\.\s+\./);
  });

  it("검사 소요시간이 말로 읽힌다", () => {
    expect(script).toContain("1시간 20분");
  });
});

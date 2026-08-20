import { describe, expect, it } from "vitest";

import { f18FdgPet } from "./rules";
import { buildTimeline } from "./schedule";
import type { Reservation } from "./schedule";
import { speechBlocks } from "./speech";

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

function blocksOf(reservation: Reservation = RESERVATION, locationId = "main") {
  return speechBlocks(
    f18FdgPet,
    buildTimeline(f18FdgPet, { reservation, locationId }),
  );
}

/** 도막을 이어 붙인 전체 원고. 내용을 볼 때 쓴다 */
function scriptOf(reservation: Reservation = RESERVATION, locationId = "main") {
  return blocksOf(reservation, locationId).join(" ");
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
      script.indexOf("핵의학과로 오셔야 합니다"),
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

/**
 * 화면과 소리는 같은 내용을 담되 같은 글자일 필요는 없다.
 *
 * 화면은 훑는 것이라 짧은 표기가 낫고, 소리는 흘러가는 것이라 조사와
 * 쉼표가 있어야 문장이 선다. 룰셋 speech_text 가 그 차이를 담는다.
 */
describe("읽어주기 — 낭독 전용 문구", () => {
  const script = scriptOf();

  /**
   * "쓰신다면 이 시각까지만" 은 눈으로는 읽히지만 귀에서는 "쓰신다면 이"
   * 가 한 덩어리로 붙어 들린다. 소리에는 쉼표로 자리를 만들어 준다.
   */
  it("문장 중간에 쉴 자리를 준다 — 당뇨 항목", () => {
    expect(script).toContain("쓰신다면, 이 시각까지만");
    expect(script).not.toContain("쓰신다면 이 시각");
  });

  it("화면 문구는 그대로다 — 바뀌는 것은 소리뿐이다", () => {
    expect(f18FdgPet.conditional[0].text).toContain("쓰신다면 이 시각까지만");
  });

  /**
   * 화면에는 시각이 왼쪽에 큰 글씨로 따로 있어 "도착" 한 마디로 충분하다.
   * 소리에는 그 배치가 없으므로 시각과 지시가 한 문장이어야 한다.
   */
  it("{time} 을 쓰면 시각이 문장 안으로 들어간다 — 도착 항목", () => {
    expect(script).toContain("오전 8시까지 본관 지하 1층 핵의학과로 오셔야 합니다");
  });

  it("문장에 들인 시각을 앞에서 또 읽지 않는다", () => {
    // "오전 8시. 본관 …" 처럼 시각만 따로 떨어진 문장이 없어야 한다
    expect(script).not.toMatch(/오전 8시\.\s/);
  });

  /**
   * 화면의 "소요" 는 표에 적힌 값이라 명사로 끝나도 읽힌다. 소리에서는
   * 문장이 끝나지 않은 채로 다음 문장이 이어져 말끝이 잘린 것처럼 들린다.
   */
  it("말끝을 맺는다 — 검사 항목", () => {
    expect(script).toContain("약 1시간 20분 소요됩니다");
    expect(f18FdgPet.exam.text.endsWith("소요")).toBe(true);
  });

  it("speech_text 가 없는 항목은 화면 문구를 그대로 읽는다", () => {
    expect(script).toContain(f18FdgPet.fasting.text);
    expect(script).toContain(f18FdgPet.restrictions[0].text.replace(/·/g, ","));
  });
});

/**
 * 화면에서는 날짜가 바뀌는 것이 빈 줄과 굵은 글씨로 보인다. 소리에는 그
 * 경계가 없어서, 쉬지 않으면 전날 할 일과 검사 당일 할 일이 한 덩어리로
 * 들린다. 쉬는 길이는 화면이 정하고, 여기서는 **쉴 자리**를 잠근다.
 */
describe("읽어주기 — 쉬는 자리", () => {
  const blocks = blocksOf();

  it("첫머리 안내 · 날짜별 하루 · Disclaimer 가 각각 한 도막이다", () => {
    // 8/19(수) 운동 제한 + 8/20(목) 검사 당일 → 2 + 2
    expect(blocks).toHaveLength(4);
  });

  it("첫 도막이 첫머리 안내다", () => {
    expect(blocks[0]).toBe(`${f18FdgPet.intro}.`);
  });

  it("마지막 도막이 Disclaimer 다", () => {
    expect(blocks[blocks.length - 1]).toContain("병원 공식 서비스가 아니며");
  });

  it("한 도막에 날짜가 둘 들어가지 않는다", () => {
    for (const block of blocks) {
      expect(block.match(/\d+월 \d+일/g)?.length ?? 0).toBeLessThanOrEqual(1);
    }
  });

  it("날짜가 도막의 첫머리에 온다 — 그 하루의 이름표다", () => {
    expect(blocks[1].startsWith("8월 19일 수요일")).toBe(true);
    expect(blocks[2].startsWith("8월 20일 목요일")).toBe(true);
  });

  it("빈 도막이 없다 — 아무 말 없이 쉬기만 하는 자리가 생기지 않는다", () => {
    for (const block of blocks) expect(block.trim()).not.toBe("");
  });

  it("하루가 한 도막이면 그 안은 이어 읽는다", () => {
    // 검사 당일 도막에 그날 항목이 모두 들어 있다
    expect(blocks[2]).toContain("드시지 마세요");
    expect(blocks[2]).toContain("핵의학과로 오셔야 합니다");
    expect(blocks[2]).toContain("검사 시작");
  });
});

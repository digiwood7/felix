import { describe, expect, it } from "vitest";

import { f18FdgPet } from "./rules";
import { buildTimeline } from "./schedule";
import type { Reservation } from "./schedule";
import { speechBlocks } from "./speech";
import { speechAudioBlocks } from "./speechAudio";

/**
 * 더빙 조각 목록 — 읽어주기(lib/speech.ts)와 같은 도막 구조.
 *
 * 잠그는 것은 하나다. **소리 조각을 이어 붙인 결과가 speechBlocks 의
 * 원고와 같은 순서·같은 내용이어야 한다.** 조각이 원고와 갈리면 화면 ·
 * 원고 · 소리 세 벌이 서로 다른 말을 하게 된다.
 */

const RESERVATION: Reservation = {
  year: 2026,
  month: 9,
  day: 10,
  hour: 8,
  minute: 25,
};

const locationOf = (id: string) =>
  f18FdgPet.locations.options.find((o) => o.id === id)!;

function blocksOf(reservation: Reservation = RESERVATION, locationId = "cancer") {
  const location = locationOf(locationId);
  const timeline = buildTimeline(f18FdgPet, { reservation, location });
  return speechAudioBlocks(f18FdgPet, timeline, location.id);
}

describe("더빙 조각 — 도막 구조", () => {
  const blocks = blocksOf();

  it("읽어주기와 도막 수가 같다 — 쉬는 자리가 같아야 한다", () => {
    const location = locationOf("cancer");
    const timeline = buildTimeline(f18FdgPet, {
      reservation: RESERVATION,
      location,
    });
    expect(blocks).toHaveLength(speechBlocks(f18FdgPet, timeline).length);
  });

  it("첫 도막은 인트로 하나다", () => {
    expect(blocks[0]).toEqual(["/audio/seg/intro.mp3"]);
  });

  it("마지막 도막은 Disclaimer 하나다", () => {
    expect(blocks[blocks.length - 1]).toEqual(["/audio/seg/disclaimer.mp3"]);
  });

  it("날짜 도막은 날짜 조각으로 시작한다", () => {
    expect(blocks[1][0]).toBe("/audio/date/2026-09-09.mp3");
    expect(blocks[2][0]).toBe("/audio/date/2026-09-10.mp3");
  });
});

describe("더빙 조각 — 항목별 맵핑 (2026-09-10 목 08:25 · 암병원)", () => {
  const blocks = blocksOf();

  it("전날 도막 — 종일 제한은 시각 조각 없이 세그먼트만", () => {
    expect(blocks[1]).toEqual([
      "/audio/date/2026-09-09.mp3",
      "/audio/seg/exercise.mp3",
    ]);
  });

  it("당일 도막 — 금식 02:00 · 당뇨 04:00 · 도착 08:00 · 검사 08:25", () => {
    expect(blocks[2]).toEqual([
      "/audio/date/2026-09-10.mp3",
      "/audio/time/02-00.mp3",
      "/audio/seg/fasting.mp3",
      "/audio/time/04-00.mp3",
      "/audio/seg/diabetes.mp3",
      "/audio/until/08-00.mp3",
      "/audio/seg/arrival-cancer.mp3",
      "/audio/time/08-25.mp3",
      "/audio/seg/exam.mp3",
    ]);
  });

  it("건물이 바뀌면 도착 세그먼트만 바뀐다", () => {
    const main = blocksOf(RESERVATION, "main");
    expect(main[2]).toContain("/audio/seg/arrival-main.mp3");
    expect(main[2]).not.toContain("/audio/seg/arrival-cancer.mp3");
  });

  /**
   * 도착은 "오전 8시까지" 가 문장 안으로 들어가는 항목이다 (speech_text 의
   * {time}). 독립 문장 억양(time/)이 아니라 이어지는 억양(until/)을 쓴다.
   */
  it("도착 시각은 until 조각이다 — time 조각이 아니다", () => {
    expect(blocks[2]).toContain("/audio/until/08-00.mp3");
    expect(blocks[2]).not.toContain("/audio/time/08-00.mp3");
  });
});

describe("더빙 조각 — 시각 계산과의 일치", () => {
  /**
   * 조각 파일명은 타임라인이 이미 내림(floor)한 시각을 그대로 쓴다.
   * 여기서 다시 계산하면 언젠가 화면과 소리가 갈린다.
   */
  it("17:30 예약 — 금식 11:30 (floor_hour), 도착 17:10 (floor_10min)", () => {
    const blocks = blocksOf({ ...RESERVATION, hour: 17, minute: 35 });
    const day = blocks[2];
    expect(day).toContain("/audio/time/11-00.mp3");
    expect(day).toContain("/audio/until/17-10.mp3");
    expect(day).toContain("/audio/time/17-35.mp3");
  });
});

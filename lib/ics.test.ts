import { describe, expect, it } from "vitest";

import { buildIcs, icsFilename } from "./ics";
import { f18FdgPet } from "./rules";
import { buildTimeline } from "./schedule";
import type { Reservation } from "./schedule";

/**
 * 캘린더 파일 — PRD §8 F3
 *
 * 여기서 잠그는 것은 두 가지다.
 *   1. **시각이 어긋나지 않는다.** 화면에 뜬 값과 캘린더에 찍히는 값이
 *      다르면 환자는 어느 쪽을 믿어야 할지 알 수 없다
 *   2. 규격을 지킨다. 줄 길이 · 줄바꿈 · 이스케이프 중 하나만 틀려도
 *      캘린더 앱이 파일을 통째로 거부한다 — 그러면 눌러도 아무 일이 없다
 */

/** 8월 20일(목) 08:25 예약 → 금식 02:00 · 도착 08:05→08:00 · 검사 80분 */
const RESERVATION: Reservation = {
  year: 2026,
  month: 8,
  day: 20,
  hour: 8,
  minute: 25,
};

/** 건물은 필수 입력이다 */
const locationOf = (id: string) =>
  f18FdgPet.locations.options.find((o) => o.id === id)!;

function icsOf(reservation: Reservation = RESERVATION, locationId = "main") {
  return buildIcs(
    f18FdgPet,
    buildTimeline(f18FdgPet, { reservation, location: locationOf(locationId) }),
  );
}

/** 접힌 줄을 원래대로 이어 붙인다. 내용을 확인할 때 쓴다 */
function unfold(ics: string): string[] {
  return ics.replace(/\r\n /g, "").split("\r\n");
}

/**
 * 일정(VEVENT) 안의 줄만.
 *
 * VTIMEZONE 안에도 DTSTART 가 있는데, 그 자리는 타임존을 **정의하는**
 * 곳이라 규격상 TZID 를 붙이면 안 된다. 섞어서 보면 잘못 잡는다.
 */
function eventLines(ics: string): string[] {
  const out: string[] = [];
  let inside = false;

  for (const line of unfold(ics)) {
    if (line === "BEGIN:VEVENT") inside = true;
    else if (line === "END:VEVENT") inside = false;
    else if (inside) out.push(line);
  }

  return out;
}

describe("캘린더 — 시각", () => {
  const lines = unfold(icsOf());

  it("금식 시작이 화면과 같은 시각으로 찍힌다", () => {
    expect(lines).toContain("DTSTART;TZID=Asia/Seoul:20260820T020000");
  });

  it("도착이 화면과 같은 시각으로 찍힌다", () => {
    expect(lines).toContain("DTSTART;TZID=Asia/Seoul:20260820T080000");
  });

  /**
   * 두 일정 모두 길이가 없다.
   *
   * 띠로 그려지면 그 끝 시각이 안내지에 없는 값인데도 지시처럼 읽힌다 —
   * "9시 30분까지는 먹어도 되나". 서비스가 만들어 낸 시각은 주지 않는다.
   */
  it("끝나는 시각을 적지 않는다 — 길이가 아니라 시점이다", () => {
    expect(lines.some((l) => l.startsWith("DTEND"))).toBe(false);
    expect(lines.some((l) => l.startsWith("DURATION"))).toBe(false);
  });

  it("일정은 금식과 도착 두 개다", () => {
    expect(lines.filter((l) => l === "BEGIN:VEVENT")).toHaveLength(2);
    expect(lines.filter((l) => l === "END:VEVENT")).toHaveLength(2);
  });

  /**
   * UTC(Z)로 바꿔 적으면 해외에 있는 보호자의 캘린더에서 다른 시각으로
   * 보인다. 이 지시는 "서울 벽시계로 2시" 이지 어떤 절대 순간이 아니다.
   */
  it("모든 일정 시각이 서울 기준으로 적힌다", () => {
    const stamps = eventLines(icsOf()).filter((l) => l.startsWith("DTSTART"));
    expect(stamps).toHaveLength(2);

    for (const line of stamps) {
      expect(line).toContain("TZID=Asia/Seoul");
      expect(line).not.toMatch(/\d{8}T\d{6}Z/);
    }
  });

  it("서머타임 없는 +0900 을 함께 싣는다", () => {
    expect(lines).toContain("BEGIN:VTIMEZONE");
    expect(lines).toContain("TZID:Asia/Seoul");
    expect(lines).toContain("TZOFFSETFROM:+0900");
    expect(lines).toContain("TZOFFSETTO:+0900");
  });

  it("자정을 넘는 예약도 날짜가 하루 밀린다 — 00:30 예약", () => {
    const lines = unfold(
      icsOf({ year: 2026, month: 8, day: 20, hour: 0, minute: 30 }),
    );
    // 금식 6시간 → 8/19 18:00
    expect(lines).toContain("DTSTART;TZID=Asia/Seoul:20260819T180000");
    // 도착 20분 전 → 8/20 00:10
    expect(lines).toContain("DTSTART;TZID=Asia/Seoul:20260820T001000");
  });

  it("연말 · 윤년을 넘겨도 어긋나지 않는다", () => {
    const newYear = unfold(
      icsOf({ year: 2027, month: 1, day: 1, hour: 0, minute: 30 }),
    );
    expect(newYear).toContain("DTSTART;TZID=Asia/Seoul:20261231T180000");

    const leap = unfold(
      icsOf({ year: 2028, month: 3, day: 1, hour: 2, minute: 0 }),
    );
    expect(leap).toContain("DTSTART;TZID=Asia/Seoul:20280229T200000");
  });

  // 기기 시계가 파일에 스며들면 같은 예약에서 매번 다른 파일이 나온다
  it("같은 예약이면 같은 파일이 나온다", () => {
    expect(icsOf()).toBe(icsOf());
  });

  it("두 번 받아도 일정이 늘지 않게 UID 가 고정이다", () => {
    const uids = unfold(icsOf()).filter((l) => l.startsWith("UID:"));
    expect(uids).toEqual(unfold(icsOf()).filter((l) => l.startsWith("UID:")));
    expect(new Set(uids).size).toBe(2);
  });
});

describe("캘린더 — 규격", () => {
  const ics = icsOf();

  it("줄바꿈이 CRLF 다", () => {
    expect(ics).toContain("\r\n");
    // LF 앞에는 반드시 CR 이 있어야 한다
    expect(ics.replace(/\r\n/g, "")).not.toContain("\n");
  });

  it("VCALENDAR 로 열고 닫는다", () => {
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });

  /**
   * 글자 수가 아니라 바이트 수다. 한글은 UTF-8 에서 3바이트라 40자만
   * 넘어도 제한을 넘는다.
   */
  it("모든 줄이 75옥텟 이하다", () => {
    for (const line of ics.split("\r\n")) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
  });

  it("접은 줄을 이어 붙이면 원문이 그대로 나온다", () => {
    const summaries = unfold(ics).filter((l) => l.startsWith("SUMMARY:"));
    expect(summaries[0]).toContain("이 시각 이후 아무것도 드시지 마세요");
    expect(summaries[1]).toContain("핵의학과로 오셔야 합니다");
  });

  it("글자 중간에서 자르지 않는다 — 깨진 글자가 없다", () => {
    expect(ics).not.toContain("�");
    expect(unfold(ics).join("")).not.toContain("�");
  });

  // 쉼표 · 세미콜론을 그대로 두면 캘린더가 값이 여러 개라고 읽는다
  it("쉼표와 세미콜론이 이스케이프된다", () => {
    const description = unfold(ics).find((l) => l.startsWith("DESCRIPTION:"))!;
    expect(description).toContain("\\,");
    expect(description).not.toMatch(/[^\\],/);
  });

  it("알림이 일정마다 붙는다", () => {
    const lines = unfold(ics);
    expect(lines.filter((l) => l === "BEGIN:VALARM")).toHaveLength(2);
    expect(lines.filter((l) => l === "TRIGGER:PT0S")).toHaveLength(2);
  });
});

describe("캘린더 — 내용", () => {
  const lines = unfold(icsOf());
  const text = lines.join("\n");

  // 화면 밖에서 뜨는 알림이다. 여기서 다른 말이 나오면 어느 쪽이 맞는지 모른다
  it("문구가 룰셋에서 온다", () => {
    expect(text).toContain(f18FdgPet.fasting.text);
    expect(text).toContain(f18FdgPet.labels.fasting);
    expect(text).toContain(f18FdgPet.labels.arrival);
  });

  it("건물이 도착 일정에 적힌다", () => {
    const main = unfold(icsOf(RESERVATION, "main")).join("\n");
    const cancer = unfold(icsOf(RESERVATION, "cancer")).join("\n");
    expect(main).toContain("본관 지하 1층 핵의학과");
    expect(cancer).toContain("암병원 지하 1층 핵의학과");
  });

  // 기기 밖으로 나가는 파일이다. 캘린더에서는 공식 안내처럼 보인다
  it("Disclaimer 가 붙는다", () => {
    expect(text).toContain("병원 공식 서비스가 아니며");
    expect(text).toContain("핵의학과 직원에게 받으세요");
  });

  it("금지 표현이 없다", () => {
    for (const word of [
      "검사 가능",
      "검사 불가",
      "괜찮습니다",
      "문제없습니다",
      "판단됩니다",
    ]) {
      // Disclaimer 의 "검사 가능 여부를 판단하지 않습니다" 는 필수 문구다
      const withoutDisclaimer = text.replaceAll(
        "검사 가능 여부를 판단하지 않습니다",
        "",
      );
      expect(withoutDisclaimer).not.toContain(word);
    }
  });

  it("개인을 가리키는 값이 없다", () => {
    expect(text).not.toMatch(/[가-힣]{2,4}\s*(님|씨)/);
    expect(text).not.toMatch(/\d{6}-\d{7}/);
  });
});

describe("캘린더 — 파일 이름", () => {
  it("검사 날짜가 들어간다", () => {
    expect(icsFilename(f18FdgPet, RESERVATION)).toBe("pet-checkup-20260820.ics");
  });

  it("이름 앞부분은 룰셋에서 읽는다", () => {
    expect(icsFilename(f18FdgPet, RESERVATION)).toContain(
      f18FdgPet.actions.calendar_file,
    );
  });
});

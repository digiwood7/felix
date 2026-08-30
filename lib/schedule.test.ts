import { describe, expect, it } from "vitest";

import { f18FdgPet } from "./rules";
import { buildTimeline } from "./schedule";
import type { Reservation, Timeline } from "./schedule";

/** 건물은 필수 입력이다. 시각 계산과는 무관하므로 하나를 고정해 쓴다 */
const CANCER = f18FdgPet.locations.options.find((o) => o.id === "cancer")!;

/**
 * T3 경계값 테스트 — R5(치명적) 대응
 *
 * 이 프로젝트에서 유일하게 "틀리면 끝나는" 지점이다.
 * 기대값은 손으로 계산해 그대로 단언한다. 구현을 보고 맞추지 않는다.
 *
 * 안전 불변조건 (PRD §9.2)
 *   금식 · 복약 마지노선 → floor_hour
 *   도착              → floor_10min
 *   새벽 보정 없음. 계산값을 그대로 쓴다
 *   모든 계산은 KST 고정
 */

function at(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): Reservation {
  return { year, month, day, hour, minute };
}

function timelineFor(reservation: Reservation): Timeline {
  return buildTimeline(f18FdgPet, { reservation, location: CANCER });
}

/** 항목을 날짜와 함께 찾는다 */
function find(timeline: Timeline, id: string) {
  for (const day of timeline) {
    const item = day.items.find((i) => i.id === id);
    if (item) return { date: day.date, weekday: day.weekday, ...item };
  }
  throw new Error(`항목을 찾을 수 없습니다: ${id}`);
}

/** "2026-08-06 02:00" 형태로 뽑아 한 번에 비교한다 */
function stamp(timeline: Timeline, id: string): string {
  const item = find(timeline, id);
  return item.allDay ? `${item.date} 종일` : `${item.date} ${item.time}`;
}

describe("1. 기준 케이스 — 2026-08-06(목) 08:25 예약", () => {
  const timeline = timelineFor(at(2026, 8, 6, 8, 25));

  // 금식 6h: 08:25 - 6:00 = 02:25 → floor_hour → 02:00
  it("금식은 당일 02:00", () => {
    expect(stamp(timeline, "fasting")).toBe("2026-08-06 02:00");
  });

  // 당뇨 4h: 08:25 - 4:00 = 04:25 → floor_hour → 04:00
  it("당뇨약 마지노선은 당일 04:00", () => {
    expect(stamp(timeline, "diabetes")).toBe("2026-08-06 04:00");
  });

  // 도착 20m: 08:25 - 0:20 = 08:05 → floor_10min → 08:00
  it("도착은 당일 08:00", () => {
    expect(stamp(timeline, "arrival")).toBe("2026-08-06 08:00");
  });

  it("검사 시작은 예약 시각 그대로 08:25", () => {
    expect(stamp(timeline, "exam")).toBe("2026-08-06 08:25");
  });

  it("운동 제한은 전날 종일", () => {
    expect(stamp(timeline, "exercise")).toBe("2026-08-05 종일");
  });

  it("요일이 표기된다", () => {
    expect(find(timeline, "exam").weekday).toBe("목");
    expect(find(timeline, "exercise").weekday).toBe("수");
  });

  it("날짜별로 그룹핑되고 날짜 오름차순이다", () => {
    expect(timeline.map((d) => d.date)).toEqual(["2026-08-05", "2026-08-06"]);
  });

  it("같은 날 항목은 시각 오름차순이다", () => {
    const day = timeline.find((d) => d.date === "2026-08-06");
    expect(day?.items.map((i) => i.id)).toEqual([
      "fasting",
      "diabetes",
      "arrival",
      "exam",
    ]);
  });
});

describe("2. 도착 시각은 10분 단위로 내린다", () => {
  // 시 단위로 내리면 10:30 → 10:00 이 되어 50분 일찍 오라고 하게 된다
  it("10:50 예약 → 도착 10:30", () => {
    expect(stamp(timelineFor(at(2026, 8, 6, 10, 50)), "arrival")).toBe(
      "2026-08-06 10:30",
    );
  });

  it("09:25 예약 → 도착 09:00", () => {
    expect(stamp(timelineFor(at(2026, 8, 6, 9, 25)), "arrival")).toBe(
      "2026-08-06 09:00",
    );
  });

  it("도착이 예약보다 30분 이상 앞서지 않는다", () => {
    for (let minute = 0; minute < 60; minute++) {
      const timeline = timelineFor(at(2026, 8, 6, 10, minute));
      const arrival = find(timeline, "arrival");
      const [h, m] = arrival.time!.split(":").map(Number);
      const gap = 10 * 60 + minute - (h * 60 + m);
      expect(gap).toBeGreaterThanOrEqual(20); // 안내지 기준 이상
      expect(gap).toBeLessThan(30); // 과도하게 이르지 않게
    }
  });
});

describe("3. 새벽 보정 없음 — 계산값을 그대로 쓴다", () => {
  it("12:00 예약 → 금식 당일 06:00", () => {
    expect(stamp(timelineFor(at(2026, 8, 6, 12, 0)), "fasting")).toBe(
      "2026-08-06 06:00",
    );
  });

  // 00:00 은 당일 자정이다. 전날로 넘기지 않는다
  it("06:00 예약 → 금식 당일 00:00", () => {
    expect(stamp(timelineFor(at(2026, 8, 6, 6, 0)), "fasting")).toBe(
      "2026-08-06 00:00",
    );
  });

  it("05:00 예약 → 금식 전날 23:00", () => {
    expect(stamp(timelineFor(at(2026, 8, 6, 5, 0)), "fasting")).toBe(
      "2026-08-05 23:00",
    );
  });
});

describe("4. 자정 넘김 — 00:30 예약", () => {
  const timeline = timelineFor(at(2026, 8, 6, 0, 30));

  // 6시간 전은 전날 18:30 → floor_hour → 18:00. 전전날이 아니다
  it("금식은 전날 18:00", () => {
    expect(stamp(timeline, "fasting")).toBe("2026-08-05 18:00");
  });

  it("당뇨약 마지노선은 전날 20:00", () => {
    expect(stamp(timeline, "diabetes")).toBe("2026-08-05 20:00");
  });

  it("도착은 당일 00:10", () => {
    expect(stamp(timeline, "arrival")).toBe("2026-08-06 00:10");
  });

  it("운동 제한은 여전히 예약 전날 종일", () => {
    expect(stamp(timeline, "exercise")).toBe("2026-08-05 종일");
  });
});

describe("5. 월말 · 연말 · 윤년 넘김", () => {
  it("2027-01-01 00:30 예약 → 금식 2026-12-31 18:00", () => {
    expect(stamp(timelineFor(at(2027, 1, 1, 0, 30)), "fasting")).toBe(
      "2026-12-31 18:00",
    );
  });

  it("2026-03-01 02:00 예약 → 금식 2026-02-28 20:00 (평년)", () => {
    expect(stamp(timelineFor(at(2026, 3, 1, 2, 0)), "fasting")).toBe(
      "2026-02-28 20:00",
    );
  });

  it("2028-03-01 02:00 예약 → 금식 2028-02-29 20:00 (윤년)", () => {
    expect(stamp(timelineFor(at(2028, 3, 1, 2, 0)), "fasting")).toBe(
      "2028-02-29 20:00",
    );
  });

  it("2026-09-01 03:00 예약 → 금식 2026-08-31 21:00 (31일 달 넘김)", () => {
    expect(stamp(timelineFor(at(2026, 9, 1, 3, 0)), "fasting")).toBe(
      "2026-08-31 21:00",
    );
  });
});

describe("6. 안전 방향 — 계산은 항상 이르게만 틀린다", () => {
  it("금식 · 복약 · 도착이 예약 시각을 넘지 않는다", () => {
    for (let hour = 0; hour < 24; hour++) {
      for (const minute of [0, 5, 25, 30, 55, 59]) {
        const timeline = timelineFor(at(2026, 8, 6, hour, minute));
        const exam = find(timeline, "exam");
        const examKey = `${exam.date} ${exam.time}`;

        for (const id of ["fasting", "diabetes", "arrival"]) {
          const item = find(timeline, id);
          expect(`${item.date} ${item.time}` <= examKey).toBe(true);
        }
      }
    }
  });

  it("내림이므로 분은 항상 예약 분 이하로만 어긋난다", () => {
    const timeline = timelineFor(at(2026, 8, 6, 9, 59));
    expect(find(timeline, "fasting").time).toBe("03:00");
    expect(find(timeline, "diabetes").time).toBe("05:00");
    expect(find(timeline, "arrival").time).toBe("09:30");
  });
});

/**
 * FDG PET 룰셋에는 금식 보조 문구가 없다 (2026-08-13 삭제).
 *
 * "전날 저녁 식사 이후로 하시면 편합니다" 는 계산된 시각 옆에 붙는
 * 또 하나의 시각 안내였고, 실무에서 쓰지 않는 문장이었다.
 *
 * 다만 note 를 붙이는 기능 자체는 다른 검사가 쓸 수 있으므로 살려 둔다.
 * 룰셋이 note 를 정의했을 때 규칙대로 동작하는지를 여기서 잠근다.
 */
describe("7. 금식 보조 문구 — 룰셋이 정의했을 때만 붙는다", () => {
  const note = "전날 저녁 식사 이후로 하시면 편합니다";

  const withNote = {
    ...f18FdgPet,
    fasting: {
      ...f18FdgPet.fasting,
      note,
      note_if_between: ["00:00", "06:00"] as [string, string],
    },
  };

  function notesOf(ruleset: typeof f18FdgPet, reservation: Reservation) {
    const timeline = buildTimeline(ruleset, {
      reservation,
      location: CANCER,
    });
    return find(timeline, "fasting").notes;
  }

  it("현행 FDG 룰셋에는 보조 문구가 없다", () => {
    expect(f18FdgPet.fasting.note).toBeUndefined();
    expect(notesOf(f18FdgPet, at(2026, 8, 6, 8, 25))).not.toContain(note);
  });

  it("02:00 금식이면 붙는다", () => {
    expect(notesOf(withNote, at(2026, 8, 6, 8, 25))).toContain(note);
  });

  // note_if_between 은 시작 포함, 끝 미포함이다
  it("06:00 금식이면 붙지 않는다 — 구간 끝은 미포함", () => {
    expect(notesOf(withNote, at(2026, 8, 6, 12, 0))).not.toContain(note);
  });

  it("00:00 금식이면 붙는다 — 구간 시작은 포함", () => {
    expect(notesOf(withNote, at(2026, 8, 6, 6, 0))).toContain(note);
  });

  it("전날 18:00 금식이면 붙지 않는다", () => {
    expect(notesOf(withNote, at(2026, 8, 6, 0, 30))).not.toContain(note);
  });
});

describe("8. 문구는 룰셋에서 읽는다", () => {
  const timeline = timelineFor(at(2026, 8, 6, 8, 25));

  it("금식 지시문", () => {
    expect(find(timeline, "fasting").text).toBe(f18FdgPet.fasting.text);
  });

  it("허용 음식과 금지 음식이 각각 다른 줄이다", () => {
    const notes = find(timeline, "fasting").notes;
    expect(notes).toContain("물(생수)만 가능합니다");
    expect(notes).toContain("보리차, 커피, 우유, 주스, 껌, 사탕도 안 됩니다");
  });

  // 기호는 읽는 사람마다 다르게 해석되고 스크린리더는 읽지 못한다
  it("금지를 기호로 표시하지 않는다", () => {
    const notes = find(timeline, "fasting").notes.join("\n");
    expect(notes).not.toContain("✕");
    expect(notes).not.toContain("×");
    expect(notes).not.toContain("❌");
  });

  it("금식 보조에 다른 검사 단서가 들어간다", () => {
    expect(find(timeline, "fasting").notes).toContain(
      f18FdgPet.fasting.allowed_note,
    );
  });

  it("도착 지시문에 선택한 건물이 들어간다", () => {
    expect(find(timeline, "arrival").text).toBe(
      "암병원 지하 1층 핵의학과로 오셔야 합니다",
    );
  });

  it("도착 보조에 혈당 측정 사실이 들어간다", () => {
    expect(find(timeline, "arrival").notes).toEqual(f18FdgPet.arrival.notes);
  });

  it("검사 소요시간이 80분 → 1시간 20분으로 표기된다", () => {
    expect(find(timeline, "exam").text).toBe("검사 시작 — 약 1시간 20분 소요");
  });

  it("검사 항목에 구간이 붙는다 — 길이와 하는 일", () => {
    const phases = find(timeline, "exam").phases!;
    expect(phases.title).toBe("검사실에서는 이렇게 진행됩니다");
    expect(phases.items.map((p) => `${p.duration} ${p.text}`)).toEqual([
      "약 5분 주사를 맞습니다",
      "약 50분 대기실에 누워 쉽니다",
      "약 5분 화장실에 다녀옵니다",
      "약 20분 촬영합니다",
    ]);
  });

  /**
   * 예약 시각에 5분씩 더해 나가면 그럴듯한 진행표가 나오지만, 앞 검사가
   * 밀리는 순간 전부 틀린다. 밀려도 틀리지 않는 것은 길이뿐이다.
   */
  it("구간에 시각을 만들지 않는다", () => {
    for (const phase of find(timeline, "exam").phases!.items) {
      expect(phase.duration).not.toMatch(/\d{1,2}:\d{2}/);
      expect(phase.text).not.toMatch(/\d{1,2}:\d{2}/);
    }
  });

  it("구간 주의사항은 그 구간에만 붙는다", () => {
    const items = find(timeline, "exam").phases!.items;
    const uptake = items.find((p) => p.id === "uptake")!;
    expect(uptake.noteSummary).toBe("대기실 주의사항");
    expect(uptake.notes).toHaveLength(4);
    // 나머지 구간에는 열 것이 없다
    for (const other of items.filter((p) => p.id !== "uptake")) {
      expect(other.noteSummary).toBeNull();
    }
  });

  it("검사 말고 다른 항목에는 구간이 없다", () => {
    for (const kind of ["fasting", "arrival", "diabetes"]) {
      expect(find(timeline, kind).phases).toBeUndefined();
    }
  });

  it("당뇨 항목은 묻지 않고 조건부 문구로 항상 나온다", () => {
    const diabetes = find(timeline, "diabetes");
    expect(diabetes.text).toContain("쓰신다면");
    expect(diabetes.notes).toContain(f18FdgPet.conditional[0].after_text);
  });
});

describe("9. 건물은 고른 대로 표기된다", () => {
  // 건물을 모르는 상태는 없다 — 주소를 읽는 문에서 걸러지고,
  // 화면은 건물이 없으면 S1 으로 되돌린다 (app/pet/page.tsx)
  it.each([
    ["main", "본관 지하 1층 핵의학과로 오셔야 합니다"],
    ["cancer", "암병원 지하 1층 핵의학과로 오셔야 합니다"],
  ])("%s 을 고르면 그 건물로 표기한다", (id, expected) => {
    const location = f18FdgPet.locations.options.find((o) => o.id === id)!;
    const timeline = buildTimeline(f18FdgPet, {
      reservation: at(2026, 8, 6, 8, 25),
      location,
    });
    expect(find(timeline, "arrival").text).toBe(expected);
  });
});

describe("10. 기기 타임존과 무관하다", () => {
  const expected = "2026-08-06 02:00";

  it.each(["UTC", "America/New_York", "Asia/Seoul", "Pacific/Kiritimati"])(
    "TZ=%s 에서도 금식이 동일하다",
    (tz) => {
      const original = process.env.TZ;
      try {
        process.env.TZ = tz;
        expect(stamp(timelineFor(at(2026, 8, 6, 8, 25)), "fasting")).toBe(
          expected,
        );
      } finally {
        process.env.TZ = original;
      }
    },
  );
});

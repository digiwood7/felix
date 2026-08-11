import { describe, expect, it } from "vitest";

import raw from "./f18-fdg-pet.json";
import { f18FdgPet } from "./index";
import type { Level, TriageCondition } from "./types";

const LEVELS: Level[] = ["ok", "tell", "call"];

const TRIAGE_CONDITIONS: TriageCondition[] = [
  "fasting.broken",
  "intake.non_water",
  "medication.taken",
  "diabetes.after_cutoff",
  "exercise.yes",
];

/**
 * 현행 실무 기준으로 확정한 값 (2026-08-10 확인).
 *
 * 이 숫자들이 이 서비스의 전부다. 하나가 틀리면 모든 환자에게
 * 일관되게 틀린 시각이 나간다.
 *
 * ⚠️ 인쇄된 구판 안내지에는 아래 세 값이 다르게 적혀 있다.
 *      소요시간 1시간 30분 / 체중 130kg 이상 / 혈당 200 이상
 *    구판이므로 따르지 않는다. 인쇄물을 보고 "정정"하지 말 것 (PRD 부록 B).
 *
 * 값을 바꿀 때는 인쇄물이 아니라 현행 실무 기준을 확인하고,
 * 커밋 본문에 근거를 남긴다.
 */
describe("룰셋 — 현행 실무 기준값", () => {
  it("금식은 6시간 전", () => {
    expect(f18FdgPet.fasting.hours).toBe(6);
  });

  it("당뇨약 · 인슐린은 4시간 전", () => {
    const diabetes = f18FdgPet.conditional.find((c) => c.id === "diabetes");
    expect(diabetes?.offset_h).toBe(-4);
  });

  it("도착은 20분 전", () => {
    expect(f18FdgPet.arrival.before_min).toBe(20);
  });

  it("검사 소요시간은 80분", () => {
    expect(f18FdgPet.duration_min).toBe(80);
  });

  it("체중 기준은 140kg", () => {
    const weight = f18FdgPet.flags.find((f) => f.id === "weight");
    expect(weight?.q).toContain("140kg");
  });

  it("혈당 기준 200은 도착 항목의 사실로 적혀 있다", () => {
    const notes = (f18FdgPet.arrival.notes ?? []).join("\n");
    expect(notes).toContain("혈당");
    expect(notes).toContain("200");
  });

  // "·" 로 이어 붙이면 좁은 화면에서 문장 한가운데가 잘린다
  it("보조 설명은 한 줄에 한 문장씩이다", () => {
    const all = [
      ...(f18FdgPet.arrival.notes ?? []),
      f18FdgPet.fasting.note,
      f18FdgPet.fasting.allowed_note,
      ...f18FdgPet.conditional.map((c) => c.after_text),
    ].filter(Boolean) as string[];

    for (const note of all) {
      expect(note).not.toContain(" · ");
    }
  });

  it("연락처는 1599-3114", () => {
    expect(f18FdgPet.levels.call).toContain("1599-3114");
  });

  it("물 단서가 들어 있다 — 같은 날 다른 검사", () => {
    expect(f18FdgPet.fasting.allowed_note).toContain("다른 검사");
  });
});

describe("룰셋 — 안전 불변조건", () => {
  it("모든 내림은 floor 계열이다. 반올림 단위가 없다", () => {
    const modes = [
      f18FdgPet.arrival.round,
      f18FdgPet.fasting.round,
      ...f18FdgPet.conditional.map((c) => c.round),
    ];
    for (const mode of modes) {
      expect(mode.startsWith("floor_")).toBe(true);
    }
  });

  it("도착 시각은 시 단위로 내리지 않는다", () => {
    // floor_hour 면 10:50 예약이 10:00 도착(50분 전)이 된다
    expect(f18FdgPet.arrival.round).toBe("floor_10min");
  });

  it("타임존이 KST로 고정되어 있다", () => {
    expect(f18FdgPet.timezone).toBe("Asia/Seoul");
  });

  // 새벽 보정은 v1.1에서 제거되었다 (PRD §9.2)
  it("early_morning_shift 가 없다", () => {
    expect(raw.fasting).not.toHaveProperty("early_morning_shift");
    expect(JSON.stringify(raw)).not.toContain("early_morning_shift");
  });

  /**
   * 혈당은 당일 병원이 측정한다. 환자 자가 응답으로 판정할 수 있는 값이 아니다.
   *
   * flags 에 넣으면 "해당 없음"을 고른 환자에게 🟢 가 뜨는데,
   * 당일 측정값이 200을 넘으면 그 환자는 검사를 못 받는다.
   * 서비스가 거짓 안심을 준 것이 되고, 이 프로젝트가 얻어야 할 신뢰를
   * 정확히 반대로 깎는다.
   */
  it("혈당은 flags 에 없다 — 환자가 판정할 수 없는 값이다", () => {
    expect(f18FdgPet.flags.find((f) => f.id === "glucose")).toBeUndefined();
  });

  it("flags 는 환자가 스스로 아는 것만 묻는다", () => {
    expect(f18FdgPet.flags.map((f) => f.id).sort()).toEqual([
      "claustro",
      "pregnancy",
      "weight",
    ]);
  });
});

describe("룰셋 — 판정이 아닌 행동 지시", () => {
  it("levels 가 3종을 모두 갖는다", () => {
    for (const level of LEVELS) {
      expect(f18FdgPet.levels[level]).toBeTruthy();
    }
  });

  it("금지 표현이 없다", () => {
    const forbidden = [
      "검사 가능",
      "검사 불가",
      "괜찮습니다",
      "문제없습니다",
      "판단됩니다",
    ];
    const json = JSON.stringify(raw);
    for (const word of forbidden) {
      expect(json).not.toContain(word);
    }
  });

  it("flags 의 level 이 전부 유효하다", () => {
    for (const flag of f18FdgPet.flags) {
      expect(LEVELS).toContain(flag.level);
    }
  });

  it("triage 의 level 과 when 이 전부 유효하다", () => {
    for (const rule of f18FdgPet.triage ?? []) {
      expect(LEVELS).toContain(rule.level);
      expect(TRIAGE_CONDITIONS).toContain(rule.when);
    }
  });
});

describe("룰셋 — 자유 입력 대체", () => {
  it("섭취 · 복약 선택지가 정의되어 있다", () => {
    expect(f18FdgPet.intake_categories.length).toBeGreaterThan(0);
    expect(f18FdgPet.medication_categories.length).toBeGreaterThan(0);
  });

  it("카테고리 id 가 중복되지 않는다", () => {
    const ids = [
      ...f18FdgPet.intake_categories,
      ...f18FdgPet.medication_categories,
    ].map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("룰셋 — 검사 장소", () => {
  it("건물이 여러 곳이므로 선택지로 정의되어 있다", () => {
    expect(f18FdgPet.locations.options.length).toBeGreaterThan(1);
  });

  it("건물 선택지 id 가 중복되지 않는다", () => {
    const ids = f18FdgPet.locations.options.map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // 서비스가 건물을 추측하면 환자가 다른 건물까지 걸어갔다 온다
  it("단일 location 필드로 건물을 고정하지 않는다", () => {
    expect(raw).not.toHaveProperty("location");
  });
});

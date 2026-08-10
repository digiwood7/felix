/**
 * 룰셋 타입 — PRD §9.1
 *
 * 검사 종류를 추가할 때 이 파일이 아니라 JSON을 추가하는 것이 원칙이다.
 * 다만 새 검사가 여기 정의되지 않은 "동작"을 요구하면(예: 새로운 round 단위,
 * 새로운 triage 조건) 코드가 그것을 해석할 줄 알아야 하므로 타입도 함께 넓힌다.
 * 값은 JSON에서, 동작의 종류는 타입에서 관리한다.
 */

/** 출력 레벨 — 판정이 아니라 행동 지시다 (PRD §9.3) */
export type Level = "ok" | "tell" | "call";

/**
 * 내림 단위 — 반올림은 어떤 경우에도 없다 (PRD §9.2).
 * 모든 시각은 이르게 틀리는 방향으로만 어긋난다.
 */
export type RoundMode = "floor_hour" | "floor_10min";

/** "HH:MM" 24시간 표기 */
export type TimeOfDay = string;

/**
 * triage 조건식 — 코드가 해석한다 (PRD §9.4).
 * 조건 판정과 등급을 분리해, level 값만 JSON에서 바꿀 수 있게 한다.
 */
export type TriageCondition =
  | "fasting.broken"
  | "intake.non_water"
  | "medication.taken"
  | "diabetes.after_cutoff"
  | "exercise.yes";

/** 제한이 시작되는 기준점 */
export type RestrictionFrom = "prev_day_start";

/** 타임라인에서의 표시 방식 */
export type RestrictionDisplay = "all_day";

export interface LocationOption {
  id: string;
  /** 선택 버튼에 쓰는 짧은 이름 */
  label: string;
  /** 타임라인에 쓰는 전체 표기 */
  text: string;
}

/**
 * 검사 장소.
 *
 * 건물이 여러 곳이면 서비스가 추측하지 않는다. 환자에게 묻는다.
 * 틀린 건물을 확신 있게 안내하면 환자가 다른 건물까지 걸어갔다 온다.
 */
export interface Locations {
  ask: string;
  hint: string;
  options: LocationOption[];
}

export interface Arrival {
  before_min: number;
  round: RoundMode;
}

export interface Fasting {
  hours: number;
  round: RoundMode;
  /** 보조 설명. 실행 조언이지 판정이 아니다 */
  note?: string;
  /** note를 이 시각 구간에서만 표시한다. 시작 포함, 끝 미포함 */
  note_if_between?: [TimeOfDay, TimeOfDay];
  allowed: string[];
  /** 허용 항목에 붙는 단서 */
  allowed_note?: string;
  forbidden: string[];
}

export interface ConditionalRule {
  id: string;
  ask: string;
  /** 예약 시각 기준 오프셋(시간). 음수가 과거다 */
  offset_h: number;
  round: RoundMode;
  text: string;
  after_text: string;
}

export interface Restriction {
  id: string;
  from: RestrictionFrom;
  display: RestrictionDisplay;
  text: string;
}

/** 자유 입력 대신 쓰는 선택지 (PRD §8 F2) */
export interface Category {
  id: string;
  label: string;
}

export interface Flag {
  id: string;
  q: string;
  level: Level;
}

export interface TriageRule {
  when: TriageCondition;
  level: Level;
  label: string;
}

export interface ExamRuleset {
  id: string;
  label: string;
  /** 계산 기준 타임존. 기기 로컬 타임존을 따르지 않는다 (PRD §9.2) */
  timezone: string;
  duration_min: number;
  locations: Locations;
  arrival: Arrival;
  fasting: Fasting;
  conditional: ConditionalRule[];
  restrictions: Restriction[];
  intake_categories: Category[];
  medication_categories: Category[];
  flags: Flag[];
  /** 없어도 flags 만으로 배지가 판정되어야 한다 (PRD §9.4) */
  triage?: TriageRule[];
  levels: Record<Level, string>;
}

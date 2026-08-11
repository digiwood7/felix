import type { ExamRuleset } from "./rules/types";

/**
 * 상태 문답 정의 — PRD §8 F2
 *
 * **문항은 전부 여기서 정의한다.** 화면 컴포넌트에 흩뿌리지 않는다.
 * W0 tally 의 "9번 기타" 원문 분석이 끝나면 T8에서 이 목록을 통째로
 * 교체하게 되는데, 정의가 화면에 섞여 있으면 그때 코드를 다 뒤져야 한다.
 *
 * 지금 문항은 **가안**이다 (PRD §8 F2). 실제 문항은 tally 가 정한다.
 *
 * 자유 텍스트 입력을 만들지 않는다.
 * 선택지는 룰셋에서 읽는다 (intake_categories / medication_categories / flags).
 */

/** 예약일 기준 상대 날짜. 절대 날짜를 묻지 않는다 — 환자가 헷갈린다 */
export type DayRef = "yesterday" | "today";

export interface TimeAnswer {
  day: DayRef;
  hour: number;
  minute: number;
}

export type QuestionKind =
  | "time" // 시각 하나
  | "optional_categories" // 없음 / 있음 → 선택지 여러 개
  | "optional_categories_time" // 없음 / 있음 → 선택지 + 시각
  | "yes_no_time" // 아니오 / 예 → 시각
  | "yes_no" // 예 / 아니오
  | "flags"; // 해당되는 것만 체크. 한 화면 한 탭

export interface Question {
  id: string;
  kind: QuestionKind;
  /** 화면 맨 위 질문 */
  title: string;
  /** 질문 아래 한 줄. 없으면 생략 */
  hint?: string;
  /** optional_* 에서 "없음" 쪽 문구 */
  noneLabel?: string;
  /** optional_* / yes_no* 에서 "있음" 쪽 문구 */
  someLabel?: string;
  /** 선택지 */
  options?: { id: string; label: string }[];
  /** 시각을 물을 때 붙는 안내 */
  timeTitle?: string;
}

export function buildQuestions(ruleset: ExamRuleset): Question[] {
  const diabetes = ruleset.conditional.find((c) => c.id === "diabetes");

  return [
    {
      id: "lastMeal",
      kind: "time",
      title: "마지막으로 음식을 드신 때는 언제인가요?",
      hint: "물은 빼고, 음식만 생각해 주세요",
    },
    {
      id: "intake",
      kind: "optional_categories",
      title: "물 외에 드신 것이 있나요?",
      hint: "커피 한 모금, 사탕 하나도 포함됩니다",
      noneLabel: "없습니다",
      someLabel: "있습니다",
      options: ruleset.intake_categories.map((c) => ({
        id: c.id,
        label: c.label,
      })),
    },
    {
      id: "medication",
      kind: "optional_categories_time",
      title: "오늘 드신 약이 있나요?",
      noneLabel: "없습니다",
      someLabel: "있습니다",
      options: ruleset.medication_categories.map((c) => ({
        id: c.id,
        label: c.label,
      })),
      timeTitle: "언제 드셨나요?",
    },
    {
      id: "diabetes",
      kind: "yes_no_time",
      title: diabetes?.ask ?? "당뇨약이나 인슐린을 사용하시나요?",
      noneLabel: "아니오",
      someLabel: "예",
      timeTitle: "마지막으로 사용하신 때는 언제인가요?",
    },
    {
      id: "exercise",
      kind: "yes_no",
      title: "어제나 오늘 과격한 운동을 하셨나요?",
      hint: "등산 · 헬스 · 골프 등",
      noneLabel: "아니오",
      someLabel: "예",
    },
    {
      id: "flags",
      kind: "flags",
      title: "해당되는 것이 있으면 눌러 주세요",
      hint: "없으면 그대로 다음을 눌러 주세요",
      options: ruleset.flags.map((f) => ({ id: f.id, label: f.q })),
    },
  ];
}

/** 문답 응답. 서버로 보내지 않는다 (PRD §8 F2) */
export interface Answers {
  /** 마지막 식사 시각 */
  lastMeal: TimeAnswer | null;
  /** 물 외 섭취. 빈 배열이면 "없음" */
  intake: string[];
  /** 복용약. null 이면 "없음". time 은 고르기 전까지 null */
  medication: { categories: string[]; time: TimeAnswer | null } | null;
  /** 당뇨약 · 인슐린. null 이면 "아니오" */
  diabetes: TimeAnswer | null;
  /** 전날 과격한 운동 */
  exercise: boolean | null;
  /** 해당되는 flags id 목록 */
  flags: string[];
}

export function emptyAnswers(): Answers {
  return {
    lastMeal: null,
    intake: [],
    medication: null,
    diabetes: null,
    exercise: null,
    flags: [],
  };
}

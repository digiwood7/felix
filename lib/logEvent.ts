import { daysUntilInKST, hourInKST, todayInKST } from "./koreanTime";
import { NONE_ID, type Answers } from "./questions";
import type { ExamRuleset, Level } from "./rules/types";

/**
 * 익명 이벤트 로그의 형태와 검증 — PRD §8 F4
 *
 * **v1 에서 대시보드는 만들지 않는다.** 여기서 하는 일은 4주 실증 뒤
 * QI 발표와 v2 대시보드가 읽을 재료를 쌓는 것뿐이다.
 *
 * 적재하는 것
 *   진입 시각 (KST 날짜 + 시간대, 분 이하는 버린다)
 *   예약일까지의 상대 거리 (D-0 · D-1 …)
 *   문답 응답의 카테고리 코드
 *   최종 배지 (ok / tell / call)
 *   도달한 화면 — 이탈 지점은 화면별 도달 수의 차이로 읽는다
 *
 * 적재하지 않는 것
 *   IP · User-Agent 원문 · 기기 식별자 · 정확한 예약 일시
 *   **키 · 몸무게 숫자.** 답했는지 여부만 남긴다
 *
 * 세션 식별자를 만들지 않는다. 이탈 지점을 사람 단위로 따라가려면
 * 방문을 잇는 값이 필요한데, 그 값이 생기는 순간 "기기 식별자를 저장하지
 * 않는다"는 약속이 해석의 문제가 된다. 화면별 도달 수만으로 깔때기는
 * 그려지고, v1 이 필요한 것은 거기까지다.
 *
 * 자유 입력 원문은 애초에 존재하지 않는다 (§8 F2 — 문답이 선택지 방식).
 */

/** 도달한 화면. S1 입력 → S2 타임라인 → S3 문답 → S4 요약카드 */
export type Screen = "s1" | "s2" | "s3" | "s4";

const SCREENS: readonly Screen[] = ["s1", "s2", "s3", "s4"];

/**
 * 예약일까지의 거리.
 *
 * 정확한 예약 일시를 담지 않기 위한 버킷이다. D-3 까지는 하루 단위로
 * 보되 그 밖은 뭉친다 — 안내문을 받는 시점(D-5쯤)과 검사 당일 대기실,
 * 두 봉우리가 갈리는지만 보면 되고 그 사이의 해상도는 쓸 데가 없다.
 */
export type Distance = "D-0" | "D-1" | "D-2" | "D-3" | "D-4~7" | "D-8+" | "past";

const DISTANCES: readonly Distance[] = [
  "D-0",
  "D-1",
  "D-2",
  "D-3",
  "D-4~7",
  "D-8+",
  "past",
];

const LEVELS: readonly Level[] = ["ok", "tell", "call"];

/** 문항 자체에서 나오는 코드. 검사 종류와 무관하게 문항 id 를 따른다 */
const FIXED_CODES: readonly string[] = [
  "fasting:kept",
  "fasting:broken",
  "diabetes:none",
  "diabetes:used",
  "body:known",
  "body:unknown",
  "female:na",
  `female:${NONE_ID}`,
];

/** 한 번에 담기는 코드는 문항 4개에서 최대 6개다. 여유를 두고 자른다 */
const MAX_CODES = 8;

/** 브라우저가 보내는 것 전부. 여기 없는 값은 서버가 통째로 버린다 */
export interface EventPayload {
  screen: Screen;
  /** 예약을 아직 모르는 S1 에서는 null */
  rel: Distance | null;
  /** S4 에서 카드가 그려졌을 때만. 그 밖에는 null */
  badge: Level | null;
  /** S4 에서 카드가 그려졌을 때만. 그 밖에는 null */
  answers: string[] | null;
}

/**
 * 저장되는 레코드.
 *
 * **진입 시각은 서버가 찍는다.** 브라우저가 보낸 시각을 믿으면 기기
 * 시계가 틀어진 만큼 분포가 틀어지고, 시각을 받는 자리가 생기면 그
 * 자리로 정확한 예약 일시가 들어올 길도 함께 열린다.
 */
export interface LoggedEvent extends EventPayload {
  /** KST 날짜 "2026-08-20" */
  d: string;
  /** KST 시간대 0~23. 분 이하는 버린다 */
  h: number;
}

/**
 * 이 룰셋에서 통과시킬 코드 전부.
 *
 * 룰셋이 아는 값만 통과시킨다 — 주소의 건물 파라미터와 같은 규칙이다.
 * flags 가 늘면 코드도 저절로 늘고, 코드는 손대지 않는다.
 */
export function allowedCodes(ruleset: ExamRuleset): Set<string> {
  return new Set([
    ...FIXED_CODES,
    ...ruleset.flags.map((flag) => `female:${flag.id}`),
  ]);
}

/**
 * 예약일까지 며칠 남았는지 → 버킷.
 *
 * 계산 경로가 아니다. 타임라인 시각은 예약 일시만으로 정해지고(PRD §9.2)
 * 이 값은 로그에만 쓴다. 그래도 KST 로 재는 함수를 쓴다 — 기기 타임존이
 * 개입하면 자정 언저리에 D-0 과 D-1 이 섞인다.
 */
export function distanceOf(examDate: string, now: number = Date.now()): Distance {
  const left = daysUntilInKST(examDate, now);
  if (left < 0) return "past";
  if (left <= 3) return `D-${left}` as Distance;
  if (left <= 7) return "D-4~7";
  return "D-8+";
}

/**
 * 문답 응답 → 카테고리 코드.
 *
 * **키 · 몸무게 숫자는 담지 않는다.** 답했는가(`body:known`)와 모른다고
 * 했는가(`body:unknown`)만 남긴다. 접수에서 줄이려는 반복 질문은
 * "재고 오셨어요?" 이지 몸무게 값 자체가 아니다.
 *
 * 아직 답하지 않은 문항은 코드를 만들지 않는다. "답 안 함" 과
 * "해당 없음" 이 한 칸에 섞이면 분포를 읽을 수 없다.
 */
export function answerCodes(ruleset: ExamRuleset, answers: Answers): string[] {
  const allowed = allowedCodes(ruleset);
  const codes: string[] = [];

  if (answers.fasting) {
    codes.push(answers.fasting.kept ? "fasting:kept" : "fasting:broken");
  }

  if (answers.diabetes) {
    codes.push(answers.diabetes.uses ? "diabetes:used" : "diabetes:none");
  }

  if (answers.body.unknown) {
    codes.push("body:unknown");
  } else if (answers.body.height !== null && answers.body.weight !== null) {
    codes.push("body:known");
  }

  if (answers.female) {
    if (!answers.female.applies) {
      codes.push("female:na");
    } else {
      for (const id of answers.female.checks) codes.push(`female:${id}`);
    }
  }

  // 룰셋이 모르는 코드는 만들지 않는다 — 만들어졌다면 그건 버그다
  return codes.filter((code) => allowed.has(code)).slice(0, MAX_CODES);
}

/**
 * 받은 것을 형태대로 걸러 낸다.
 *
 * 열린 엔드포인트다. 아는 값만 통과시키고 하나라도 어긋나면 통째로
 * 버린다 — 일부만 살려 두면 저장소에 "형태가 반쯤 맞는 레코드" 가
 * 쌓이고, 대시보드를 만들 v2 가 그걸 전부 방어해야 한다.
 */
export function sanitizePayload(
  ruleset: ExamRuleset,
  raw: unknown,
): EventPayload | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;

  const input = raw as Record<string, unknown>;

  const screen = input.screen;
  if (typeof screen !== "string" || !SCREENS.includes(screen as Screen)) {
    return null;
  }

  const rel = pick(input.rel, DISTANCES);
  if (rel === undefined) return null;

  const badge = pick(input.badge, LEVELS);
  if (badge === undefined) return null;

  let answers: string[] | null = null;
  if (input.answers !== null && input.answers !== undefined) {
    if (!Array.isArray(input.answers)) return null;
    if (input.answers.length > MAX_CODES) return null;

    const allowed = allowedCodes(ruleset);
    for (const code of input.answers) {
      if (typeof code !== "string" || !allowed.has(code)) return null;
    }
    // 같은 코드를 여러 번 보내 분포를 부풀리지 못하게 한다
    answers = [...new Set(input.answers as string[])];
  }

  return { screen: screen as Screen, rel, badge, answers };
}

/**
 * 목록에 있는 값이거나 null 이면 그대로, 아니면 undefined(= 거절).
 *
 * null 과 "잘못된 값" 을 반환값으로 갈라 둔다. 둘 다 null 로 돌려주면
 * 부르는 쪽에서 거절할 수가 없다.
 */
function pick<T extends string>(
  value: unknown,
  allowed: readonly T[],
): T | null | undefined {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return undefined;
  return allowed.includes(value as T) ? (value as T) : undefined;
}

/** 걸러 낸 payload 에 서버 시각을 찍어 저장할 레코드로 만든다 */
export function toLoggedEvent(
  payload: EventPayload,
  now: number = Date.now(),
): LoggedEvent {
  return { d: todayInKST(now), h: hourInKST(now), ...payload };
}

import type { StoredAnswers } from "./answers";
import type { Answers, TimeAnswer } from "./questions";
import { MENSTRUATION_ID, NONE_ID } from "./questions";
import type { ExamRuleset } from "./rules/types";

/**
 * 문답 응답 ↔ URL 문자열 — PRD §8 F3 · §12
 *
 * 서버에 아무것도 저장하지 않으면서 카드를 다시 열고 남에게 보낼 수 있게
 * 하는 방법은 하나뿐이다. **상태를 주소에 담는 것.**
 *
 *   /pet/card?t=202608201425&b=main&a=1-20260820-y-n-168.62-y02.4
 *                                     └─────────┬─────────┘
 *                                        이 파일이 만드는 부분
 *
 * 형식 — `-` 로 나눈 여섯 칸. 빈 칸은 "아직 답하지 않음" 이다.
 *
 *   1-20260820-y-n-168.62-y02.4
 *   │ │        │ │ │      └ 여성 문항: 해당됨 · flags[0]·flags[2] · 생리 4일째
 *   │ │        │ │ └ 키 168 · 몸무게 62
 *   │ │        │ └ 당뇨약 · 인슐린: 쓰지 않음
 *   │ │        └ 금식: 지킴
 *   │ └ 답한 날 (KST). 검사 당일 답인지 가리는 데 쓴다
 *   └ 형식 판
 *
 * **암호화하지 않는다.** 담기는 것은 숫자와 룰셋에 정의된 항목의 자리번호
 * 뿐이다. 자유 입력이 애초에 없으므로 "혈압약" 같은 원문이 생기지 않고,
 * 이름 · 등록번호 · 생년월일도 받은 적이 없다. 이 조합으로는 개인을
 * 특정할 수 없다 (PRD §14). 감출 것이 없으니 열쇠도 필요 없다.
 *
 * **읽는 쪽은 절대 던지지 않는다.** 주소는 사람이 손으로 고칠 수 있고
 * 메신저가 끝을 잘라 먹기도 한다. 형식이 어긋나면 null 을 돌려주고,
 * 화면은 "아직 답하지 않으셨습니다" 로 되돌아간다. 반쯤 읽어 낸 답으로
 * 카드를 그리지 않는다 — 접수에 내미는 화면이기 때문이다.
 */

/**
 * 형식 판.
 *
 * 읽는 쪽이 모르는 판이면 통째로 버린다. 자리 뜻이 바뀌었는데 옛 주소를
 * 그대로 읽으면 **틀린 카드가 조용히 그려진다.** 버리면 다시 답하게 될
 * 뿐이지만, 잘못 읽으면 직원이 그것을 사실로 받는다.
 */
export const FORMAT_VERSION = "1";

/** 칸 구분 */
const FIELD = "-";

/**
 * 키 · 몸무게를 나눈다.
 *
 * `.` 이 아니다. 몸무게는 62.5 처럼 소수점이 올 수 있어서, 점으로 나누면
 * `168.62.5` 가 되어 세 토막으로 읽힌다. 그러면 주소 전체가 버려지고
 * **만든 사람 화면에는 카드가 멀쩡히 보이는데 받은 사람만 빈 화면을 본다.**
 */
const BODY_SUB = "x";

/** 고른 항목과 생리 일수를 나눈다. 항목은 36진수라 점이 섞일 수 없다 */
const SUB = ".";

/** 예약일 기준 어제/오늘 */
const YESTERDAY = "0";
const TODAY = "1";

/** "셋 다 해당사항 없음". 자리번호(36진수)와 겹치지 않는 글자라야 한다 */
const NONE_MARK = "_";

/**
 * 키 · 몸무게를 모른다고 답함.
 *
 * `?` 를 쓰지 않는다 — 주소에 실을 때 `%3F` 로 바뀌어 링크가 길어지고,
 * 사람이 눈으로 훑을 때도 주소가 두 번 시작하는 것처럼 보인다.
 */
const UNKNOWN_MARK = "_";

export function encodeAnswers(
  ruleset: ExamRuleset,
  stored: StoredAnswers,
): string {
  const a = stored.answers;

  return [
    FORMAT_VERSION,
    stored.savedOn.replaceAll("-", ""),
    encodeFasting(a),
    encodeDiabetes(a),
    encodeBody(a),
    encodeFemale(ruleset, a),
  ].join(FIELD);
}

/**
 * 형식이 조금이라도 어긋나면 null.
 *
 * "읽을 수 있는 데까지 읽는다" 를 하지 않는다. 반만 읽힌 답은 없는 답보다
 * 위험하다 — 금식 칸이 깨져 빈 값이 되면 화면에는 "답하지 않음" 이 뜨는데,
 * 나머지 칸이 멀쩡해 보이니 직원은 카드 전체를 믿는다.
 */
export function decodeAnswers(
  ruleset: ExamRuleset,
  value: unknown,
): StoredAnswers | null {
  /**
   * 글자가 아니면 읽지 않는다.
   *
   * `?a=1&a=2` 처럼 같은 이름이 두 번 오면 Next 는 배열을 준다. 문자열로
   * 믿고 자르면 그 자리에서 500 이 뜬다 — 접수 창구에서 흰 화면이다.
   * 주소는 사람이 손으로 고칠 수 있으므로, 들어오는 값의 생김새부터 의심한다.
   */
  if (typeof value !== "string" || value === "") return null;

  const parts = value.split(FIELD);
  if (parts.length !== 6) return null;

  const [version, savedOnRaw, fastingRaw, diabetesRaw, bodyRaw, femaleRaw] =
    parts;
  if (version !== FORMAT_VERSION) return null;

  const savedOn = decodeSavedOn(savedOnRaw);
  const fasting = decodeFasting(fastingRaw);
  const diabetes = decodeDiabetes(diabetesRaw);
  const body = decodeBody(ruleset, bodyRaw);
  const female = decodeFemale(ruleset, femaleRaw);

  if (
    savedOn === null ||
    fasting === undefined ||
    diabetes === undefined ||
    body === undefined ||
    female === undefined
  ) {
    return null;
  }

  return { savedOn, answers: { fasting, diabetes, body, female } };
}

/* ── 쓰기 ────────────────────────────────────────────────── */

function encodeFasting(a: Answers): string {
  if (!a.fasting) return "";
  if (a.fasting.kept) return "y";
  return a.fasting.time ? `n${encodeTime(a.fasting.time)}` : "n";
}

function encodeDiabetes(a: Answers): string {
  if (!a.diabetes) return "";
  if (!a.diabetes.uses) return "n";
  return a.diabetes.time ? `y${encodeTime(a.diabetes.time)}` : "y";
}

function encodeBody(a: Answers): string {
  if (a.body.unknown) return UNKNOWN_MARK;

  const height = encodeNumber(a.body.height);
  const weight = encodeNumber(a.body.weight);
  // 한쪽만 채운 상태는 답이 아니다. 화면이 넘겨 주지도 않는다
  if (height === null || weight === null) return "";

  return `${height}${BODY_SUB}${weight}`;
}

/**
 * 잴 수 있는 값만 적는다.
 *
 * NaN · 무한대 · 음수는 답이 아니다. 그대로 적으면 "NaN" 이나 "-5" 가
 * 주소에 실리는데, 후자는 칸 구분자와 겹쳐 주소를 통째로 못 쓰게 만든다.
 * 화면이 이런 값을 넘겨 주지는 않지만, 주소를 만드는 쪽에서 막아 둔다.
 */
function encodeNumber(value: number | null): string | null {
  if (value === null || !Number.isFinite(value) || value <= 0) return null;
  return String(value);
}

/**
 * 고른 항목은 **룰셋 flags 의 자리번호**로 적는다.
 *
 * id 를 그대로 적으면 주소가 세 배로 길어지고, 첫 글자만 따면 다른 검사에서
 * 부딪친다. 자리번호는 룰셋이 바뀌면 뜻이 달라지므로, flags 를 건드리면
 * 형식 판을 올리도록 encode.test.ts 가 막고 있다.
 */
function encodeFemale(ruleset: ExamRuleset, a: Answers): string {
  if (!a.female) return "";
  if (!a.female.applies) return "n";

  if (a.female.checks.includes(NONE_ID)) return `y${NONE_MARK}`;

  const marks = a.female.checks
    .map((id) => ruleset.flags.findIndex((f) => f.id === id))
    .filter((i) => i >= 0)
    .sort((x, y) => x - y)
    .map((i) => i.toString(36))
    .join("");

  // 해당된다고 했는데 아무것도 고르지 않은 상태는 답이 아니다
  if (marks === "") return "";

  const day = a.female.menstrualDay;
  return day === null ? `y${marks}` : `y${marks}${SUB}${day}`;
}

/** "어제 21:00" → "02100" */
function encodeTime(t: TimeAnswer): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${t.day === "yesterday" ? YESTERDAY : TODAY}${pad(t.hour)}${pad(t.minute)}`;
}

/* ── 읽기 ────────────────────────────────────────────────── */
/* 형식 오류는 undefined, "답하지 않음" 은 null 이다. 둘은 다른 뜻이다 */

/** "20260820" → "2026-08-20". 2월 30일 같은 날짜는 받지 않는다 */
function decodeSavedOn(raw: string): string | null {
  if (!/^\d{8}$/.test(raw)) return null;

  const year = Number(raw.slice(0, 4));
  const month = Number(raw.slice(4, 6));
  const day = Number(raw.slice(6, 8));
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  // Date.UTC 는 넘치면 다음 달로 굴러간다. 되돌려 확인한다
  const back = new Date(Date.UTC(year, month - 1, day));
  if (
    back.getUTCFullYear() !== year ||
    back.getUTCMonth() !== month - 1 ||
    back.getUTCDate() !== day
  ) {
    return null;
  }

  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
}

function decodeFasting(raw: string): Answers["fasting"] | undefined {
  if (raw === "") return null;
  if (raw === "y") return { kept: true, time: null };
  if (!raw.startsWith("n")) return undefined;

  const rest = raw.slice(1);
  if (rest === "") return { kept: false, time: null };

  const time = decodeTime(rest);
  return time === undefined ? undefined : { kept: false, time };
}

function decodeDiabetes(raw: string): Answers["diabetes"] | undefined {
  if (raw === "") return null;
  if (raw === "n") return { uses: false, time: null };
  if (!raw.startsWith("y")) return undefined;

  const rest = raw.slice(1);
  if (rest === "") return { uses: true, time: null };

  const time = decodeTime(rest);
  return time === undefined ? undefined : { uses: true, time };
}

function decodeBody(
  ruleset: ExamRuleset,
  raw: string,
): Answers["body"] | undefined {
  if (raw === "") return { height: null, weight: null, unknown: false };
  if (raw === UNKNOWN_MARK) {
    return { height: null, weight: null, unknown: true };
  }

  const parts = raw.split(BODY_SUB);
  if (parts.length !== 2) return undefined;

  const { height: hField, weight: wField } = ruleset.questions.body;
  const height = decodeNumber(parts[0], hField.min, hField.max);
  const weight = decodeNumber(parts[1], wField.min, wField.max);
  if (height === null || weight === null) return undefined;

  return { height, weight, unknown: false };
}

function decodeFemale(
  ruleset: ExamRuleset,
  raw: string,
): Answers["female"] | undefined {
  if (raw === "") return null;
  if (raw === "n") return { applies: false, checks: [], menstrualDay: null };
  if (!raw.startsWith("y")) return undefined;

  const rest = raw.slice(1);
  if (rest === NONE_MARK) {
    return { applies: true, checks: [NONE_ID], menstrualDay: null };
  }

  const [marks, dayRaw, ...extra] = rest.split(SUB);
  if (extra.length > 0 || marks === "") return undefined;

  const checks: string[] = [];
  for (const mark of marks) {
    const index = parseInt(mark, 36);
    // 이 룰셋에 없는 자리번호다. 무엇을 고른 것인지 알 수 없으므로 버린다
    if (Number.isNaN(index) || index >= ruleset.flags.length) return undefined;
    const id = ruleset.flags[index].id;
    if (checks.includes(id)) return undefined;
    checks.push(id);
  }

  if (dayRaw === undefined) return { applies: true, checks, menstrualDay: null };

  // 일수는 생리를 고른 경우에만 뜻이 있다
  if (!checks.includes(MENSTRUATION_ID)) return undefined;
  const day = decodeNumber(dayRaw, 1, ruleset.questions.female.day_max);
  if (day === null || !Number.isInteger(day)) return undefined;

  return { applies: true, checks, menstrualDay: day };
}

/** "02100" → 어제 21:00 */
function decodeTime(raw: string): TimeAnswer | undefined {
  if (!/^[01]\d{4}$/.test(raw)) return undefined;

  const hour = Number(raw.slice(1, 3));
  const minute = Number(raw.slice(3, 5));
  if (hour > 23 || minute > 59) return undefined;

  return {
    day: raw[0] === YESTERDAY ? "yesterday" : "today",
    hour,
    minute,
  };
}

/**
 * 범위를 벗어나거나 숫자가 아니면 null.
 *
 * 소수점을 받는다 — 몸무게 62.5 는 사람이 실제로 적는 값이다.
 * 다만 "007" · "1e2" · "+5" 처럼 같은 수를 여러 방식으로 적은 것은 받지
 * 않는다. 읽는 방식이 여럿이면 같은 답이 다른 주소를 갖게 된다.
 */
function decodeNumber(raw: string, min: number, max: number): number | null {
  if (!/^[1-9]\d*(\.\d+)?$/.test(raw)) return null;
  const value = Number(raw);
  return value >= min && value <= max ? value : null;
}

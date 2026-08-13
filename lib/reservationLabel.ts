import type { Reservation } from "./schedule";
import { WEEKDAYS } from "./schedule";
import type { ExamRuleset } from "./rules/types";

/**
 * 예약 일시 · 장소를 사람이 읽는 문자열로 바꾼다.
 *
 * 계산이 아니라 표기만 한다. 그래도 KST 고정 규칙은 그대로 지킨다 —
 * 요일을 new Date(y, m, d) 로 구하면 기기 타임존에 따라 하루가 밀린다.
 * schedule.ts 와 같은 방식(Date.UTC + getUTC*)을 쓴다.
 */

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** 2026-08-06 → "목" */
export function weekdayOfReservation(r: Reservation): string {
  const epoch = Date.UTC(r.year, r.month - 1, r.day);
  return WEEKDAYS[new Date(epoch).getUTCDay()];
}

/** "2026년 8월 6일 (목)" */
export function formatReservationDate(r: Reservation): string {
  return `${r.year}년 ${r.month}월 ${r.day}일 (${weekdayOfReservation(r)})`;
}

/**
 * "08:25"
 *
 * 안내문과 예약 문자가 이 형식이라 대조가 쉽다.
 * 다만 이 표기만으로는 오전인지 오후인지 한눈에 안 들어오는 사람이 있어서,
 * 확인 화면에서는 아래 한국어 표기를 함께 보여 준다.
 */
export function formatReservationTime(r: Reservation): string {
  return `${pad(r.hour)}:${pad(r.minute)}`;
}

/** "오후 2시 25분" — 분이 0이면 "오후 2시" */
export function formatReservationTimeKorean(r: Reservation): string {
  const meridiem = r.hour < 12 ? "오전" : "오후";
  const hour12 = r.hour % 12 === 0 ? 12 : r.hour % 12;
  const minute = r.minute === 0 ? "" : ` ${r.minute}분`;
  return `${meridiem} ${hour12}시${minute}`;
}

/**
 * 장소 표기. 룰셋에서 읽는다 — 건물 이름을 화면에 하드코딩하지 않는다.
 * 고르지 않았거나 모르는 id 면 룰셋의 fallback_text 를 쓴다.
 */
export function formatLocation(
  ruleset: ExamRuleset,
  locationId?: string | null,
): string {
  const found = ruleset.locations.options.find((o) => o.id === locationId);
  return found ? found.text : ruleset.locations.fallback_text;
}

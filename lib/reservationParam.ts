import type { Reservation } from "./schedule";

/**
 * URL 파라미터 `?t=202608060825` ↔ 예약 일시
 *
 * 개인 식별 정보가 아니다. 검사 종류와 일시만으로는 개인을 특정할 수 없다
 * (PRD §14). 그래서 암호화하지 않고 그대로 읽는다.
 *
 * 잘못된 값으로 진입해도 절대 크래시하지 않는다. null 을 돌려주고
 * 호출 측에서 S1 으로 되돌린다.
 */

const PATTERN = /^\d{12}$/;

export function parseReservationParam(
  value: string | undefined | null,
): Reservation | null {
  if (!value || !PATTERN.test(value)) return null;

  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(4, 6));
  const day = Number(value.slice(6, 8));
  const hour = Number(value.slice(8, 10));
  const minute = Number(value.slice(10, 12));

  if (month < 1 || month > 12) return null;
  if (hour > 23 || minute > 59) return null;

  // 2월 30일 같은 값을 걸러낸다. Date.UTC 는 넘치면 다음 달로 굴러간다
  const back = new Date(Date.UTC(year, month - 1, day, hour, minute));
  if (
    back.getUTCFullYear() !== year ||
    back.getUTCMonth() !== month - 1 ||
    back.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day, hour, minute };
}

export function formatReservationParam(r: Reservation): string {
  const pad = (n: number, width = 2) => String(n).padStart(width, "0");
  return `${pad(r.year, 4)}${pad(r.month)}${pad(r.day)}${pad(r.hour)}${pad(r.minute)}`;
}

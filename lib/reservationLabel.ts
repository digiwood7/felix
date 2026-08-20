import type { Reservation } from "./schedule";
import { WEEKDAYS } from "./schedule";
import type { LocationOption } from "./rules/types";

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
 *
 * 건물은 주소를 읽는 문(lib/searchParam.ts)에서 이미 해석되어 들어온다.
 * 여기서 다시 찾지 않으므로 "모르는 건물" 이라는 경우가 없다.
 */
export function formatLocation(location: LocationOption): string {
  return location.text;
}

/** 읽으면 받침으로 끝나는 숫자 — 공 · 일 · 삼 · 육 · 칠 · 팔 */
const CODA_DIGITS = new Set(["0", "1", "3", "6", "7", "8"]);

/**
 * 줄바꿈 없는 붙임표 (U+2011).
 *
 * 좁은 화면에서 브라우저는 붙임표 뒤에서 줄을 바꾼다. 전화번호 한가운데가
 * `02)3410-` / `2620으로` 로 갈라지면 잘못 눌러 다른 곳으로 전화가 간다.
 * `word-break: keep-all` 도 `line-break: strict` 도 이 자리를 막지 못해서
 * 글자 자체를 바꾼다. 룰셋에는 보통 붙임표로 적어 두고 여기서만 바꾼다.
 */
const NB_HYPHEN = "‑";

/**
 * 룰셋 문구의 `{phone}` 자리에 **그 건물의** 접수처 연락처를 넣는다.
 *
 * 번호는 건물이 정한다. 대표번호로 안내하면 환자가 교환을 거쳐 다시
 * 연결되고, 그 사이에 줄이려던 전화 응대가 오히려 두 번 일어난다.
 * 그래서 건물을 모르는 채로 이 함수를 부를 방법을 남기지 않았다 —
 * 건물은 인자로 받고, 없으면 애초에 화면이 그려지지 않는다.
 *
 * 조사는 룰셋에 `(으)로` 로 적어 두고 여기서 푼다. 앞 숫자를 읽은 소리에
 * 따라 갈리기 때문이다 — 2620 은 "공" 으로 끝나 받침이 있고(으로),
 * 2622 는 "이" 로 끝나 받침이 없다(로). 번호가 바뀔 때마다 문구를 고쳐
 * 쓰지 않도록 규칙으로 둔다.
 *
 * 문장을 새로 만들지 않는다. 룰셋이 준 문구의 빈자리만 채운다.
 */
export function fillPhone(text: string, location: LocationOption): string {
  const phone = location.phone;
  const lastDigit = phone.replace(/[^0-9]/g, "").slice(-1);

  return text
    .replace("{phone}", phone.replaceAll("-", NB_HYPHEN))
    .replace("(으)로", CODA_DIGITS.has(lastDigit) ? "으로" : "로");
}

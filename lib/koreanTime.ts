/**
 * "02:00" → "오전 2시" — 스크린리더와 읽어주기(TTS)용
 *
 * 화면에는 "02:00"을 그대로 보여준다. 숫자가 빠르게 읽힌다.
 * 다만 스크린리더는 "02:00"을 "영이 콜론 영영"처럼 읽어 버리므로
 * aria-label 로 사람이 말하는 형태를 따로 준다 (WCAG 1.3.1).
 *
 * T10 읽어주기에서도 같은 함수를 쓴다.
 *
 * 오전/오후로만 표기한다. "새벽 2시"가 자연스럽긴 하지만
 * 경계(밤/새벽/아침)를 정하는 순간 해석의 여지가 생긴다.
 * 검사 준비 지시에서는 자연스러움보다 모호하지 않은 쪽이 낫다.
 */
export function toKoreanTimeLabel(time: string): string {
  const [hourText, minuteText] = time.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);

  const meridiem = hour < 12 ? "오전" : "오후";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;

  return minute === 0
    ? `${meridiem} ${hour12}시`
    : `${meridiem} ${hour12}시 ${minute}분`;
}

/** "2026-08-06" + "02:00" → "2026-08-06T02:00" (time 요소의 dateTime) */
export function toDateTimeAttr(date: string, time: string | null): string {
  return time ? `${date}T${time}` : date;
}

/** "2026-08-06" → "8월 6일" */
export function toKoreanDateLabel(date: string): string {
  return `${Number(date.slice(5, 7))}월 ${Number(date.slice(8, 10))}일`;
}

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * 지금이 KST 로 며칠인지 — "2026-08-20"
 *
 * **계산 경로에서 쓰지 않는다.** 시각 계산은 예약 일시만으로 이뤄지고
 * (PRD §9.2), 이 값은 "오늘이 검사일인가" 를 가려 화면을 다르게
 * 보여주는 데만 쓴다. 기기 시계가 틀려도 계산값은 흔들리지 않는다.
 *
 * 기기 타임존은 개입하지 않는다 — UTC 밀리초에 9시간을 더한 뒤
 * toISOString(UTC 기준) 으로 읽으므로 어느 나라에서 열어도 같다.
 * getFullYear() 같은 로컬 API 는 쓰지 않는다.
 */
export function todayInKST(now: number = Date.now()): string {
  return new Date(now + KST_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * 지금이 KST 로 몇 시인지 — 0~23
 *
 * 익명 로그의 진입 시간대에만 쓴다 (PRD §8 F4). 분 이하는 버린다.
 * todayInKST 와 같은 방식으로 UTC 문자열에서 잘라내므로 기기 타임존이
 * 무엇이든 같은 값이 나온다.
 */
export function hourInKST(now: number = Date.now()): number {
  return Number(new Date(now + KST_OFFSET_MS).toISOString().slice(11, 13));
}

/**
 * 지금이 KST 로 몇 시 몇 분인지 — "08:05"
 *
 * 문답에 답한 시각을 카드에 적는 데 쓴다 (PRD §8 F2).
 * `todayInKST` 와 같은 규칙이다 — 계산 경로가 아니라 표기용이고,
 * 기기 타임존이 무엇이든 같은 값이 나온다.
 */
export function nowTimeInKST(now: number = Date.now()): string {
  return new Date(now + KST_OFFSET_MS).toISOString().slice(11, 16);
}

/**
 * 지금(KST)이 그 날짜 · 시각보다 이른가.
 *
 * `todayInKST` 와 같은 규칙이다 — **계산 경로에서 쓰지 않는다.**
 * 기기 시계가 틀려도 타임라인의 시각은 흔들리지 않고, 이 값은
 * 화면을 다르게 보여주는 데만 쓴다.
 *
 * ISO 문자열을 분 단위까지 잘라 사전순으로 비교한다. 두 값 모두
 * 0으로 채워진 같은 형식이므로 사전순 비교가 곧 시각 비교가 된다.
 */
export function isBeforeInKST(
  date: string,
  time: string,
  now: number = Date.now(),
): boolean {
  const nowKST = new Date(now + KST_OFFSET_MS).toISOString().slice(0, 16);
  return nowKST < `${date}T${time}`;
}

/**
 * 그 날짜 · 시각으로부터 지금까지 몇 분이 지났는지 (KST).
 *
 * 카드에 "3시간 20분 전에 답하신 내용입니다" 를 적는 데 쓴다 (PRD §8 F2).
 * 접수 직원이 14:09 를 보고 머릿속으로 빼기를 하지 않게 하려는 것이고,
 * 그 뺄셈을 대신하는 것이 이 서비스가 하는 일이다.
 *
 * **판정하지 않는다.** 몇 시간이 지나야 오래된 것인지는 값이 아니라
 * 판단이고, 이 서비스는 판단하지 않는다 (원칙 2). 지난 시간은 사실이다.
 *
 * `todayInKST` 와 같은 규칙이다 — 계산 경로가 아니라 표기용이다.
 * 기기 시계가 뒤로 가 있으면 음수가 나온다. 부르는 쪽이 가린다.
 */
export function minutesSinceInKST(
  date: string,
  time: string,
  now: number = Date.now(),
): number {
  const at = Date.parse(`${date}T${time}:00Z`);
  const nowKST = Date.parse(
    `${new Date(now + KST_OFFSET_MS).toISOString().slice(0, 16)}:00Z`,
  );
  return Math.floor((nowKST - at) / 60_000);
}

/**
 * KST 기준으로 오늘부터 그 날짜까지 며칠 남았는지.
 * 오늘이면 0, 내일이면 1, 어제면 -1.
 */
export function daysUntilInKST(date: string, now: number = Date.now()): number {
  const day = (value: string) => Date.parse(`${value}T00:00:00Z`);
  return Math.round((day(date) - day(todayInKST(now))) / 86_400_000);
}

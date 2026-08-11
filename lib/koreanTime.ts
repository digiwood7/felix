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

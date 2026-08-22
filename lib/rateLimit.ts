/**
 * 적재 속도 상한 — /api/log 가 저장소를 태우지 못하게 한다
 *
 * 열린 엔드포인트에 상한이 없으면, 스크립트 한 줄이 두 가지를 동시에 깬다.
 *
 *   **비용** — Upstash 무료 티어는 월 50만 명령이다. 이벤트 하나에 명령
 *   두 개(LPUSH·LTRIM)를 쓰므로, 초당 몇 건만 꾸준히 들어와도 며칠 만에
 *   한도를 넘긴다. 넘긴 뒤의 쓰기 실패는 **로그가 비어 있는 것과 구분되지
 *   않는다** (lib/logStore.ts 의 MAX_RECORDS 주석과 같은 문제다).
 *
 *   **데이터** — 상한 5만 줄을 밀어내면 진짜 방문 기록이 앞에서부터
 *   사라진다. 4주 실증이 끝난 뒤에야 알게 된다.
 *
 * **IP 별로 세지 않는다.** 세려면 IP 를 읽어야 하고, 읽지 않는 것으로
 * 저장하지 않음을 보장한다는 원칙이 그 순간 해석의 문제가 된다
 * (app/api/log/route.ts). 그래서 **엔드포인트 전체**에 하나의 상한을 둔다.
 * 누가 넘겼는지는 알 필요가 없다. 알아야 할 것은 저장소가 안전한가뿐이다.
 *
 * 숫자의 근거 — 검사 하루 30~60명 × 화면 4개 ≈ 하루 240건 ≈ 분당 0.2건.
 * 아침에 몰리는 것을 감안해도 분당 4~5건이다. 상한을 분당 6건 + 순간
 * 60건으로 두면 실사용의 30배 여유가 있고, 상한에 붙어 있는 공격조차
 * 월 26만 명령이라 무료 티어 안에서 끝난다.
 *
 * 프로세스 안에서만 센다. 서버리스 인스턴스가 여럿이면 상한도 그만큼
 * 늘지만, 상태 저장소를 하나 더 붙이는 값(왕복 한 번 = 명령 한 개)을
 * 치르면서 지킬 종류의 정확도가 아니다. 목적은 "정확한 제한" 이 아니라
 * "저장소를 태우는 규모를 못 만들게" 다.
 */

/** 순간에 받아 줄 최대치. 대기실에서 여러 명이 동시에 눌러도 걸리지 않는다 */
const BURST = 60;

/** 채워지는 속도. 분당 6건 */
const REFILL_PER_MS = 6 / 60_000;

export interface RateLimiter {
  /** 받아도 되면 true. 넘겼으면 false — 부르는 쪽은 조용히 버린다 */
  take(now?: number): boolean;
}

export function createRateLimiter(
  burst: number = BURST,
  refillPerMs: number = REFILL_PER_MS,
): RateLimiter {
  let tokens = burst;
  let last = -1;

  return {
    take(now: number = Date.now()): boolean {
      // 첫 호출은 기준 시각만 잡는다. 프로세스가 뜬 시각을 알 필요는 없다
      if (last < 0) last = now;

      // 시계가 뒤로 갔으면(재시작·보정) 채우지 않는다. 음수를 더하면
      // 토큰이 줄어 정상 요청이 막힌다
      const elapsed = Math.max(0, now - last);
      last = now;

      tokens = Math.min(burst, tokens + elapsed * refillPerMs);

      if (tokens < 1) return false;
      tokens -= 1;
      return true;
    },
  };
}

/** /api/log 가 쓰는 하나. 모듈 하나에 상한 하나다 */
export const logRateLimiter = createRateLimiter();

import type { LoggedEvent } from "./logEvent";

/**
 * 익명 로그 적재 — 서버에서만 부른다
 *
 * **PRD §12 가 지목한 "Vercel KV" 는 없어졌다.** Vercel 은 2024년 12월에
 * 자체 KV · Postgres 를 접고 Marketplace 연동으로 넘겼고, 기존 스토어는
 * Upstash Redis 로 자동 이관됐다. 그래서 여기서는 Upstash 의 REST API 를
 * 직접 부른다 (2026-08-20 확인).
 *
 * SDK(@upstash/redis)를 넣지 않는다. fetch 한 번이면 되는 일에 의존성을
 * 늘리면 3G 에서 1.5초 기준(PRD §13)을 지키는 예산이 줄어든다.
 *
 * v1 은 적재만 한다. 읽는 화면은 만들지 않는다 — 도달률 20% 수준에서는
 * 볼 데이터가 없고, 대시보드는 4주 실증 뒤 v2 의 일이다.
 */

/** 적재 목록. 하나의 리스트에 JSON 한 줄씩 쌓는다 */
export const LOG_KEY = "petlog:events";

/**
 * 보관 상한.
 *
 * 4주 실증에서 나올 양보다 한참 크지만 상한 자체는 둔다. 무료 티어의
 * 저장 한도를 넘겨 쓰기가 조용히 실패하기 시작하면, 로그가 비어 있는
 * 것과 구분할 방법이 없다.
 */
const MAX_RECORDS = 50_000;

/**
 * 접속 정보.
 *
 * 이름을 둘 다 본다 — Vercel Marketplace 로 붙이면 `KV_REST_API_*` 가,
 * Upstash 콘솔에서 직접 받으면 `UPSTASH_REDIS_REST_*` 가 들어온다.
 * 어느 쪽으로 연결하든 코드를 고치지 않게 한다.
 *
 * 모듈이 아니라 함수 안에서 읽는다. 모듈 최상단에서 읽으면 빌드 시점의
 * 값이 굳어, 환경변수를 바꾸고 재배포해도 반영되지 않는 경우가 생긴다.
 */
function credentials(): { url?: string; token?: string } {
  return {
    url: process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL,
    token:
      process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN,
  };
}

/** 저장소가 연결되어 있는가. 없으면 로그는 조용히 버려진다 */
export function isLogStoreConfigured(): boolean {
  const { url, token } = credentials();
  return Boolean(url && token);
}

/**
 * 레코드 한 줄을 쌓는다. 성공했으면 true.
 *
 * 저장소가 없으면 false 를 돌려주고 아무 일도 하지 않는다. **연결 전에도
 * 서비스는 정상 동작해야 한다** — 로그는 부가 기능이고, 로그 때문에
 * 환자 화면이 멈추는 것은 어떤 이유로도 정당화되지 않는다.
 *
 * LPUSH 와 LTRIM 을 pipeline 으로 묶어 왕복 한 번에 끝낸다.
 */
export async function appendEvent(event: LoggedEvent): Promise<boolean> {
  const { url, token } = credentials();
  if (!url || !token) return false;

  const response = await fetch(`${url.replace(/\/$/, "")}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      ["LPUSH", LOG_KEY, JSON.stringify(event)],
      ["LTRIM", LOG_KEY, "0", String(MAX_RECORDS - 1)],
    ]),
    cache: "no-store",
  });

  return response.ok;
}

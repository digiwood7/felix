import { sanitizePayload, toLoggedEvent } from "@/lib/logEvent";
import { appendEvent } from "@/lib/logStore";
import { f18FdgPet } from "@/lib/rules";

/**
 * 익명 이벤트 수집 — PRD §8 F4
 *
 * **읽지 않는 것으로 저장하지 않음을 보장한다.**
 * request.headers 를 열지 않는다. IP 도 User-Agent 도 여기서는 존재하지
 * 않는 값이다. "저장하지 않는다" 를 저장 직전에 지우는 방식으로 지키면
 * 언젠가 지우는 줄이 빠진다.
 *
 * kill switch 는 이 파일보다 먼저다 — middleware.ts 의 matcher 가
 * /api/log 도 포함하므로, maintenance 상태에서는 이 핸들러가 아예
 * 실행되지 않는다 (CLAUDE.md 아키텍처 규칙).
 *
 * 응답은 언제나 204 다. 잘못된 형태를 알려 주지 않는다 — 보내는 쪽은
 * 응답을 보지 않고(lib/logSend.ts), 통과 조건을 알려 주면 그것이
 * 저장소를 오염시키는 설명서가 된다.
 */

// 로그는 캐시할 것이 없다. 정적으로 굳으면 적재가 조용히 멈춘다
export const dynamic = "force-dynamic";

/**
 * 본문 상한.
 *
 * 통과하는 payload 는 200바이트를 넘지 않는다. 상한을 크게 잡아 두면
 * 파싱 비용을 남이 정하게 된다.
 */
const MAX_BODY_BYTES = 2_000;

export async function POST(request: Request) {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) return accepted();

  let raw: unknown;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return accepted();
    raw = JSON.parse(text);
  } catch {
    return accepted();
  }

  const payload = sanitizePayload(f18FdgPet, raw);
  if (!payload) return accepted();

  try {
    await appendEvent(toLoggedEvent(payload));
  } catch {
    // 저장소가 죽어도 여기서 끝난다. 부르는 쪽은 응답을 보지 않는다
  }

  return accepted();
}

function accepted(): Response {
  return new Response(null, { status: 204 });
}

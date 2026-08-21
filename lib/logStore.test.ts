import { afterEach, describe, expect, it, vi } from "vitest";

import { appendEvent, firstFilled, isLogStoreConfigured } from "./logStore";

/**
 * 익명 로그 저장소 — PRD §8 F4
 *
 * 여기서 지키는 것은 하나다. **저장소가 붙었는데도 조용히 안 쌓이는 상태를
 * 만들지 않는다.**
 *
 * 로그는 부가 기능이라 실패해도 화면이 멈추지 않는다. 그 설계가 옳은
 * 만큼, 실패가 밖에서 보이지 않는다는 뜻이기도 하다. 그래서 "값이 있다"의
 * 판정은 테스트로 묶어 둔다.
 */

const NAMES = [
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "KV_REST_API_URL",
  "KV_REST_API_TOKEN",
] as const;

/** 테스트가 실행 환경의 실제 값에 영향받지 않게 넷 다 지우고 시작한다 */
function withEnv(values: Partial<Record<(typeof NAMES)[number], string>>) {
  for (const name of NAMES) vi.stubEnv(name, values[name] ?? "");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("firstFilled — 빈 값을 건너뛴다", () => {
  /**
   * 이 테스트가 이 파일의 이유다.
   *
   * `??` 를 쓰면 빈 문자열이 통과해 뒤의 진짜 값을 가린다.
   * 2026-08-21 에 실제로 그렇게 로그가 멈췄다.
   */
  it("빈 문자열을 건너뛰고 뒤의 값을 쓴다", () => {
    expect(firstFilled("", "진짜값")).toBe("진짜값");
  });

  it("공백만 있는 값도 없는 것으로 본다", () => {
    expect(firstFilled("   ", "진짜값")).toBe("진짜값");
    expect(firstFilled("\n", "진짜값")).toBe("진짜값");
  });

  it("undefined 를 건너뛴다", () => {
    expect(firstFilled(undefined, "진짜값")).toBe("진짜값");
  });

  it("앞의 값이 멀쩡하면 그것을 쓴다", () => {
    expect(firstFilled("앞", "뒤")).toBe("앞");
  });

  // 대시보드에 붙여 넣을 때 줄바꿈이 딸려 오면 주소가 조용히 깨진다
  it("앞뒤 공백을 잘라낸다", () => {
    expect(firstFilled("  https://example.upstash.io\n")).toBe(
      "https://example.upstash.io",
    );
  });

  it("전부 비어 있으면 undefined", () => {
    expect(firstFilled(undefined, "", "  ")).toBeUndefined();
  });
});

describe("isLogStoreConfigured", () => {
  it("Marketplace 이름(KV_*)만 있어도 붙은 것으로 본다", () => {
    withEnv({
      KV_REST_API_URL: "https://example.upstash.io",
      KV_REST_API_TOKEN: "토큰",
    });
    expect(isLogStoreConfigured()).toBe(true);
  });

  it("Upstash 콘솔 이름(UPSTASH_*)만 있어도 붙은 것으로 본다", () => {
    withEnv({
      UPSTASH_REDIS_REST_URL: "https://example.upstash.io",
      UPSTASH_REDIS_REST_TOKEN: "토큰",
    });
    expect(isLogStoreConfigured()).toBe(true);
  });

  /**
   * 실제로 일어난 사고의 재현.
   *
   * 이름만 만들어 두고 값을 비워 둔 UPSTASH_* 가 진짜 값이 든 KV_* 를
   * 가려서, 로그가 4주 내내 조용히 버려질 뻔했다.
   */
  it("빈 UPSTASH_* 가 있어도 KV_* 로 넘어간다", () => {
    withEnv({
      UPSTASH_REDIS_REST_URL: "",
      UPSTASH_REDIS_REST_TOKEN: "",
      KV_REST_API_URL: "https://example.upstash.io",
      KV_REST_API_TOKEN: "토큰",
    });
    expect(isLogStoreConfigured()).toBe(true);
  });

  it("아무것도 없으면 붙지 않은 것으로 본다", () => {
    withEnv({});
    expect(isLogStoreConfigured()).toBe(false);
  });

  // 반쪽만 있는 것은 없는 것이다. 주소만으로는 쓸 수 없다
  it("주소만 있고 토큰이 없으면 붙지 않은 것으로 본다", () => {
    withEnv({ KV_REST_API_URL: "https://example.upstash.io" });
    expect(isLogStoreConfigured()).toBe(false);
  });
});

describe("appendEvent", () => {
  const event = {
    d: "2026-08-21",
    h: 16,
    screen: "s2",
    rel: "D-1",
    badge: null,
    answers: null,
  } as const;

  it("저장소가 없으면 아무 데도 부르지 않고 false 를 돌려준다", async () => {
    withEnv({});
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await expect(appendEvent(event)).resolves.toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("빈 UPSTASH_* 에 막히지 않고 KV_* 주소로 보낸다", async () => {
    withEnv({
      UPSTASH_REDIS_REST_URL: "",
      UPSTASH_REDIS_REST_TOKEN: "",
      KV_REST_API_URL: "https://example.upstash.io",
      KV_REST_API_TOKEN: "토큰",
    });
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 200 }));

    await expect(appendEvent(event)).resolves.toBe(true);

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://example.upstash.io/pipeline");
    expect(init.headers).toMatchObject({ Authorization: "Bearer 토큰" });
  });

  // 주소 끝의 슬래시가 그대로 붙으면 //pipeline 이 되어 404 가 난다
  it("주소 끝의 슬래시를 정리한다", async () => {
    withEnv({
      KV_REST_API_URL: "https://example.upstash.io/",
      KV_REST_API_TOKEN: "토큰",
    });
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 200 }));

    await appendEvent(event);

    expect(fetchSpy.mock.calls[0][0]).toBe("https://example.upstash.io/pipeline");
  });
});

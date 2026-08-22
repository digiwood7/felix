import { describe, expect, it } from "vitest";

import { createRateLimiter } from "./rateLimit";

/** 분당 6건 = 10초에 하나 */
const REFILL = 6 / 60_000;

describe("createRateLimiter", () => {
  it("순간 상한까지는 그대로 받는다", () => {
    const limiter = createRateLimiter(60, REFILL);
    const now = 1_000_000;

    for (let i = 0; i < 60; i += 1) {
      expect(limiter.take(now)).toBe(true);
    }
  });

  it("상한을 넘기면 막는다", () => {
    const limiter = createRateLimiter(3, REFILL);
    const now = 1_000_000;

    expect(limiter.take(now)).toBe(true);
    expect(limiter.take(now)).toBe(true);
    expect(limiter.take(now)).toBe(true);
    expect(limiter.take(now)).toBe(false);
  });

  it("시간이 지나면 채워진다", () => {
    const limiter = createRateLimiter(3, REFILL);
    const now = 1_000_000;

    for (let i = 0; i < 3; i += 1) limiter.take(now);
    expect(limiter.take(now)).toBe(false);

    // 10초 뒤 하나
    expect(limiter.take(now + 10_000)).toBe(true);
    expect(limiter.take(now + 10_000)).toBe(false);
  });

  it("오래 조용했어도 순간 상한 이상으로는 쌓이지 않는다", () => {
    const limiter = createRateLimiter(3, REFILL);
    const now = 1_000_000;

    limiter.take(now);
    // 하루 뒤
    const later = now + 86_400_000;
    for (let i = 0; i < 3; i += 1) expect(limiter.take(later)).toBe(true);
    expect(limiter.take(later)).toBe(false);
  });

  it("시계가 뒤로 가도 토큰이 줄지 않는다", () => {
    const limiter = createRateLimiter(3, REFILL);
    const now = 1_000_000;

    limiter.take(now);
    expect(limiter.take(now - 60_000)).toBe(true);
    expect(limiter.take(now - 60_000)).toBe(true);
    expect(limiter.take(now - 60_000)).toBe(false);
  });
});

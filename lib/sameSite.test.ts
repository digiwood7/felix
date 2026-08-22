import { describe, expect, it } from "vitest";

import { isCrossSiteRequest } from "./sameSite";

function withSite(value?: string): Headers {
  return new Headers(value === undefined ? {} : { "sec-fetch-site": value });
}

describe("isCrossSiteRequest", () => {
  it("이 서비스 화면에서 보낸 것은 통과시킨다", () => {
    expect(isCrossSiteRequest(withSite("same-origin"))).toBe(false);
  });

  it("같은 도메인의 다른 호스트(www 등)도 통과시킨다", () => {
    expect(isCrossSiteRequest(withSite("same-site"))).toBe(false);
  });

  it("페이지가 대신 보낸 것이 아니면 통과시킨다", () => {
    expect(isCrossSiteRequest(withSite("none"))).toBe(false);
  });

  it("다른 사이트가 대신 보낸 것은 막는다", () => {
    expect(isCrossSiteRequest(withSite("cross-site"))).toBe(true);
  });

  it("헤더가 없으면 막지 않는다 — 옛 WebView 에서 로그가 빠지는 편이 낫다", () => {
    expect(isCrossSiteRequest(withSite())).toBe(false);
  });
});

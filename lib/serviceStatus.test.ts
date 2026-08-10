import { describe, expect, it } from "vitest";

import { resolveServiceStatus } from "./serviceStatus";

describe("resolveServiceStatus", () => {
  it("maintenance 이면 서비스를 멈춘다", () => {
    expect(resolveServiceStatus("maintenance")).toBe("maintenance");
  });

  it("대소문자·공백이 섞여도 인식한다", () => {
    expect(resolveServiceStatus("  MAINTENANCE  ")).toBe("maintenance");
    expect(resolveServiceStatus("Maintenance")).toBe("maintenance");
  });

  it("값이 없으면 정상 동작한다", () => {
    expect(resolveServiceStatus(undefined)).toBe("live");
    expect(resolveServiceStatus("")).toBe("live");
  });

  // 오타로 서비스가 멈추면 안 된다. 멈추는 것은 명시적 의도여야 한다.
  it("알 수 없는 값은 정상으로 본다", () => {
    expect(resolveServiceStatus("maintenence")).toBe("live");
    expect(resolveServiceStatus("true")).toBe("live");
    expect(resolveServiceStatus("off")).toBe("live");
  });
});

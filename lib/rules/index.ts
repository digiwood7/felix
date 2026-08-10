import raw from "./f18-fdg-pet.json";
import type { ExamRuleset } from "./types";

/**
 * JSON 임포트는 리터럴 타입이 넓어져(예: "call" → string) ExamRuleset 에
 * 그대로 대입되지 않는다. 캐스팅으로 넘기고, 실제 값 검증은
 * rules.test.ts 에서 런타임으로 한다.
 */
export const f18FdgPet = raw as unknown as ExamRuleset;

export const rulesets: Record<string, ExamRuleset> = {
  [f18FdgPet.id]: f18FdgPet,
};

export function getRuleset(id: string): ExamRuleset | undefined {
  return rulesets[id];
}

export * from "./types";

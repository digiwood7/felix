import type { ExamRuleset, LocationOption } from "./rules/types";

/**
 * 주소 파라미터를 읽는 문 하나.
 *
 * 같은 이름이 두 번 오면(`?a=1&a=2`) Next 는 배열을 준다. 화면 코드가
 * 문자열이라고 믿고 자르면 그 자리에서 500 이 뜨는데, 이 서비스에서
 * 흰 화면이 뜨는 곳은 접수 창구다.
 *
 * **둘 중 하나를 고르지 않는다.** 환자가 어느 쪽을 뜻했는지 알 수 없으므로
 * 답이 없는 것으로 본다. 주소가 이상하면 다시 답하게 하면 되지만,
 * 아무 값이나 골라 읽으면 틀린 카드가 조용히 그려진다.
 */
export function oneParam(
  value: string | string[] | undefined,
): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/**
 * 건물 — **룰셋이 아는 값만 통과시키고, 통과한 것은 해석해서 돌려준다.**
 *
 * id 문자열이 아니라 건물 자체를 돌려주는 것이 요점이다. 접수처 연락처는
 * 건물마다 다르고(본관 · 암병원), 화면 코드가 id 를 들고 다니면 그리는
 * 순간마다 "이 id 를 모르면 어쩌지" 를 다시 정해야 한다. 그 자리가 여러 개면
 * 언젠가 한 곳이 다른 답을 낸다 — 틀린 번호로 전화가 가는 방향으로.
 *
 * 해석을 이 문 하나로 모으면 그 뒤로는 "건물을 모르는 상태" 가 없다.
 *
 * 받은 값을 그대로 주소에 되돌려 넣지 않기 위한 문이기도 하다. `?b=%00`
 * 처럼 제어 문자가 섞여 오면 리다이렉트 헤더가 깨져 500 이 뜬다.
 *
 * 모르는 건물은 "안 고른 것" 으로 본다. 서비스가 건물을 추측하지 않는다.
 */
export function locationParam(
  ruleset: ExamRuleset,
  value: string | string[] | undefined,
): LocationOption | undefined {
  const id = oneParam(value);
  return ruleset.locations.options.find((o) => o.id === id);
}

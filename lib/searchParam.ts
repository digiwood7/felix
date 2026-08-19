import type { ExamRuleset } from "./rules/types";

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
 * 건물 id — **룰셋이 아는 값만 통과시킨다.**
 *
 * 받은 값을 그대로 주소에 되돌려 넣으면 안 된다. `?b=%00` 처럼 제어 문자가
 * 섞여 오면 리다이렉트 헤더가 깨져 500 이 뜬다. 표기에 쓸 때도 모르는
 * 값이면 어차피 fallback_text 로 떨어지므로, 여기서 한 번에 걸러 둔다.
 *
 * 모르는 건물은 "안 고른 것" 으로 본다. 서비스가 건물을 추측하지 않는다.
 */
export function locationParam(
  ruleset: ExamRuleset,
  value: string | string[] | undefined,
): string | undefined {
  const id = oneParam(value);
  return ruleset.locations.options.some((o) => o.id === id) ? id : undefined;
}

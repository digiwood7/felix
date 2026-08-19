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

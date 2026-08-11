import type { Answers } from "./questions";

/**
 * S3 → S4 로 응답을 넘기는 임시 통로.
 *
 * **T9 에서 URL 인코딩으로 교체된다.** 그때 이 파일은 사라진다.
 * PRD §12 는 "URL 파라미터 인코딩 — 서버 저장 없이 재접근·공유 가능" 이
 * 최종 형태라고 정해 두었다. 지금은 T7(요약카드)을 먼저 만들기 위한
 * 최소 수단일 뿐이다.
 *
 * sessionStorage 를 쓰는 이유
 *   탭을 닫으면 사라진다. 지금 단계에서는 카드를 공유하거나 다시 열 수
 *   없는데, localStorage 에 남겨 두면 다음에 열었을 때 지난 응답이
 *   되살아나 엉뚱한 카드가 나온다.
 *
 * 서버로는 보내지 않는다 (PRD §8 F2).
 */

const KEY = "pet-time:answers";

export function saveAnswers(answers: Answers): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(answers));
  } catch {
    // 비공개 모드 등. 저장 실패가 흐름을 막지 않는다
  }
}

export function loadAnswers(): Answers | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Answers) : null;
  } catch {
    return null;
  }
}

export function clearAnswers(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // 무시
  }
}

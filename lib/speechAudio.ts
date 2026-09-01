import type { ExamRuleset } from "./rules/types";
import type { Timeline, TimelineItem } from "./schedule";

/**
 * 더빙 조각 목록 — 읽어주기 원고(lib/speech.ts)의 소리 파일판.
 *
 * public/audio/ 에 미리 생성해 둔 일레븐랩스 조각을, speechBlocks 와
 * **같은 도막 구조**로 나열한다. 도막 사이에서 쉬는 규칙(800ms)은
 * 재생하는 쪽(components/SpeakButton.tsx)이 원고 때와 똑같이 적용한다.
 *
 * 조각 네 종류:
 *   seg/    원테이크 고정 세그먼트 — 문구가 바뀌지 않는 덩어리
 *   time/   독립 문장 시각 "오전 8시 25분." — 금식 · 복약 · 검사 앞에 붙는다
 *   until/  문장 중간 시각 "오전 8시까지" — 도착 문장에만 쓴다. 뒤로
 *           이어지는 억양이라 time/ 과 바꿔 쓸 수 없다
 *   date/   "9월 10일 목요일." — 날짜 도막의 첫머리
 *
 * **시각을 다시 계산하지 않는다.** 파일명은 타임라인이 이미 내림(floor)한
 * item.time 을 그대로 쓴다. 여기서 다시 계산하면 언젠가 화면과 소리가
 * 갈린다.
 *
 * 조각이 없을 수 있다 — 날짜 풀 범위 밖의 예약, 5분 단위가 아닌 시각.
 * 그 판정은 여기서 하지 않는다. 재생하는 쪽이 로드 실패를 만나면
 * 브라우저 TTS 로 폴백한다. 목록은 사실만 나열한다.
 *
 * 룰셋에 conditional 항목이나 restriction 이 늘면 seg/{id}.mp3 도 함께
 * 생성해야 한다 (scripts 의 일레븐랩스 배치).
 */

const BASE = "/audio";

/** "08:25" → "08-25" (파일명은 콜론을 쓸 수 없다) */
function timeFile(time: string): string {
  return time.replace(":", "-");
}

function itemChunks(item: TimelineItem, locationId: string): string[] {
  switch (item.kind) {
    case "restriction":
      // 종일 항목 — 시각 조각이 없다. "하루 종일" 은 세그먼트 안에 있다
      return [`${BASE}/seg/${item.id}.mp3`];
    case "fasting":
      return [`${BASE}/time/${timeFile(item.time!)}.mp3`, `${BASE}/seg/fasting.mp3`];
    case "conditional":
      return [`${BASE}/time/${timeFile(item.time!)}.mp3`, `${BASE}/seg/${item.id}.mp3`];
    case "arrival":
      // {time} 이 문장 안으로 들어가는 항목 — 이어지는 억양(until/)을 쓴다
      return [
        `${BASE}/until/${timeFile(item.time!)}.mp3`,
        `${BASE}/seg/arrival-${locationId}.mp3`,
      ];
    case "exam":
      return [`${BASE}/time/${timeFile(item.time!)}.mp3`, `${BASE}/seg/exam.mp3`];
  }
}

/**
 * 한 도막 = 이어 재생하는 조각 목록. 도막과 도막 사이에서 쉰다.
 *
 * speechBlocks 와 같은 구조다 — 첫머리 안내 · 날짜별 하루 · Disclaimer.
 */
export function speechAudioBlocks(
  _ruleset: ExamRuleset,
  timeline: Timeline,
  locationId: string,
): string[][] {
  const blocks: string[][] = [[`${BASE}/seg/intro.mp3`]];

  for (const day of timeline) {
    const chunks: string[] = [`${BASE}/date/${day.date}.mp3`];
    for (const item of day.items) {
      chunks.push(...itemChunks(item, locationId));
    }
    blocks.push(chunks);
  }

  blocks.push([`${BASE}/seg/disclaimer.mp3`]);

  return blocks;
}

import { DISCLAIMER } from "./disclaimer";
import { toKoreanDateLabel, toKoreanTimeLabel } from "./koreanTime";
import type { ExamRuleset } from "./rules/types";
import type { Timeline } from "./schedule";

/**
 * 읽어주기 원고 — PRD §8 F3
 *
 * 고령 환자는 읽기보다 듣기가 쉽다. 음성 *입력* 은 어렵지만 음성 *출력* 은
 * 브라우저에 들어 있어 비용이 거의 없다.
 *
 * 화면에 보이는 것과 같은 내용을 같은 순서로 읽는다. 다른 것을 읽으면
 * 옆에서 듣는 보호자가 어느 쪽이 맞는지 알 수 없다.
 *
 * **화면용 글자를 그대로 읽히지 않는다.** 화면은 훑는 것이고 소리는
 * 흘러가는 것이라, 눈으로 구분되던 것이 귀에서는 뭉친다.
 *   "02:00"  → 기계가 "영이 콜론 영영" 으로 읽는다
 *   "·"      → 읽지 못하거나 "가운뎃점" 이라고 읽는다
 *   줄바꿈    → 소리에는 없다. 문장 끝을 마침표로 만들어 줘야 쉰다
 *
 * **날짜 단위로 끊어 돌려준다.** 화면에서는 날짜가 바뀌는 것이 빈 줄과
 * 굵은 글씨로 보이지만 소리에는 그 경계가 없다. 마침표 하나로는 "전날"
 * 과 "검사 당일" 이 이어져 들려, 오늘 할 일과 내일 할 일이 섞인다.
 * 쉬는 길이는 화면(components/SpeakButton.tsx)이 정한다.
 */

/** 소리로는 구분되지 않는 기호. 쉼표로 바꿔 쉬는 자리를 만든다 */
const SEPARATORS = /[·•∙]/g;
/** 줄표는 읽지 않는다. 앞뒤가 붙어 들리지 않게 쉼표로 바꾼다 */
const DASHES = /\s*[—–-]\s*/g;

/** 룰셋 speech_text 안의 이 자리에 그 항목의 시각이 말로 들어간다 */
const TIME_SLOT = "{time}";

/**
 * 한 도막 = 쉬지 않고 이어 읽는 덩어리. 도막과 도막 사이에서 쉰다.
 *
 * 첫머리 안내 · 날짜별 하루 · Disclaimer 가 각각 한 도막이다.
 */
export function speechBlocks(
  ruleset: ExamRuleset,
  timeline: Timeline,
): string[] {
  const blocks: string[][] = [[ruleset.intro]];

  for (const day of timeline) {
    const sentences: string[] = [
      `${toKoreanDateLabel(day.date)} ${day.weekday}요일`,
    ];

    for (const item of day.items) {
      const time = item.allDay ? "하루 종일" : toKoreanTimeLabel(item.time!);
      const spoken = item.speechText ?? item.text;

      if (spoken.includes(TIME_SLOT)) {
        // 시각을 문장 안으로 들인다. "오후 3시. 도착." 이 아니라
        // "오후 3시까지 오셔야 합니다." 로 한 문장이 된다
        sentences.push(spoken.replace(TIME_SLOT, time));
      } else {
        sentences.push(time);
        sentences.push(spoken);
      }

      sentences.push(...item.notes);
    }

    blocks.push(sentences);
  }

  // 화면 하단에 늘 있는 문장이다. 듣기만 하는 사람에게도 닿아야 한다
  blocks.push([DISCLAIMER]);

  return blocks
    .map((sentences) => sentences.map(forSpeech).filter(Boolean).join(" "))
    .filter(Boolean);
}

/**
 * 한 도막을 소리로 낼 수 있게 다듬고, 끝에 마침표를 붙인다.
 *
 * 마침표가 없으면 다음 도막과 이어 붙어 한 문장처럼 읽힌다. 그러면
 * "오전 2시 이 시각 이후 아무것도 드시지 마세요 물만 가능합니다" 가
 * 숨 쉴 곳 없이 흘러간다.
 */
function forSpeech(text: string): string {
  const cleaned = text
    .replace(SEPARATORS, ",")
    .replace(DASHES, ", ")
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned === "") return "";
  return /[.!?]$/.test(cleaned) ? cleaned : `${cleaned}.`;
}

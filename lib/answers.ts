import type { Answers } from "./questions";
import { nowTimeInKST, todayInKST } from "./koreanTime";

/**
 * 문답 응답의 보관 — **변하는 것과 변하지 않는 것을 나눠 둔다.**
 *
 * 환자는 안내문을 받은 날(D-5쯤) 타임라인을 보고, 검사 당일 대기실에서
 * 요약카드를 만든다. 두 시점 사이에 무엇을 남길지가 이 파일의 전부다.
 *
 *   금식 · 당뇨약 시각 · 생리 여부  → **당일 사실.** 남기지 않는다
 *   키 · 몸무게                     → 안 변한다. 기기에 남긴다
 *
 * 당일 사실을 미리 저장해 두면 접수에서 어제 답으로 만든 카드를 내밀게
 * 된다. 🟢 가 떠 있는데 실제로는 아침에 뭘 드신 상태일 수 있다.
 * 오래된 카드는 카드가 없는 것보다 나쁘다.
 *
 * 서버로는 아무것도 보내지 않는다 (PRD §8 F2).
 *
 * T9 부터 당일 응답은 **주소에도 실린다** (lib/encode.ts). 여기 세션은
 * 같은 기기에서 뒤로 갔다 오는 길을 위한 것이고, 다른 기기에서 열리는
 * 카드는 주소에 실린 값으로 그려진다. 주소에 답이 있으면 그쪽이 먼저다.
 */

/** 당일 응답. 탭을 닫으면 사라진다 */
const SESSION_KEY = "pet-time:answers:v2";

/** 키 · 몸무게. 다음 검사에도 그대로 쓴다 */
const BODY_KEY = "pet-time:body";

export interface StoredAnswers {
  answers: Answers;
  /** 답한 날짜 (KST, "YYYY-MM-DD"). 카드가 오늘 것인지 가리는 데 쓴다 */
  savedOn: string;
  /**
   * 답한 시각 (KST, "HH:MM"). **카드에 사실로 적는다.**
   *
   * 날짜만으로는 같은 날 안의 변화를 잡지 못한다 — 아침 8시에 "당뇨약
   * 안 씀 · 금식 지킴" 으로 🟢 를 만들고, 11시에 약을 먹고, 17:30 에 그
   * 카드를 내밀면 날짜가 같아서 그대로 통과한다. **카드가 8시의 사실을
   * 17:30 에 말하게 된다.**
   *
   * 막지 않는다. 몇 시간이 지나야 오래된 것인지는 값이 아니라 판단이고,
   * 이 서비스는 판단하지 않는다. 대신 **언제 답한 것인지를 적어**
   * 직원이 "그 뒤로 드신 것 없으시죠?" 한 번만 묻게 한다.
   */
  savedAt: string;
}

/**
 * 저장한 내용을 그대로 돌려준다.
 *
 * 답한 날짜(KST)가 여기서 정해지므로, 부르는 쪽이 그 값을 다시 구하면
 * 자정 언저리에 두 값이 갈린다. 주소에 실을 것도 이 값이라야 한다.
 */
export function saveAnswers(answers: Answers): StoredAnswers {
  // 날짜와 시각을 같은 Date.now() 에서 뽑는다. 따로 부르면 자정 언저리에
  // 날짜는 어제인데 시각은 오늘인 값이 만들어진다
  const now = Date.now();
  const stored: StoredAnswers = {
    answers,
    savedOn: todayInKST(now),
    savedAt: nowTimeInKST(now),
  };

  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(stored));
  } catch {
    // 비공개 모드 등. 저장 실패가 흐름을 막지 않는다
  }

  // 키 · 몸무게만 따로 남긴다. 다음에 다시 묻지 않기 위해서다
  if (answers.body.height !== null && answers.body.weight !== null) {
    try {
      localStorage.setItem(
        BODY_KEY,
        JSON.stringify({
          height: answers.body.height,
          weight: answers.body.weight,
        }),
      );
    } catch {
      // 무시
    }
  }

  return stored;
}

export function loadAnswers(): StoredAnswers | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as StoredAnswers;
    // 형태가 다르면 없는 것으로 본다. 옛 응답으로 카드를 그리지 않는다
    return stored?.answers && stored?.savedOn && stored?.savedAt
      ? stored
      : null;
  } catch {
    return null;
  }
}

export function clearAnswers(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // 무시
  }
}

export interface StoredBody {
  height: number;
  weight: number;
}

/**
 * 지난번에 답한 키 · 몸무게.
 *
 * 이름도 등록번호도 아니고 이 기기에만 남는다. 서버로 가지 않는다.
 * 그래도 불러왔다는 사실은 화면에 밝히고 지울 수 있게 한다 —
 * 모르고 그대로 넘기면 옛 몸무게로 체중 상한이 판정된다.
 */
export function loadBody(): StoredBody | null {
  try {
    const raw = localStorage.getItem(BODY_KEY);
    if (!raw) return null;
    const body = JSON.parse(raw) as StoredBody;
    return typeof body?.height === "number" && typeof body?.weight === "number"
      ? body
      : null;
  } catch {
    return null;
  }
}

export function clearBody(): void {
  try {
    localStorage.removeItem(BODY_KEY);
  } catch {
    // 무시
  }
}

/**
 * 룰셋 타입 — PRD §9.1
 *
 * 검사 종류를 추가할 때 이 파일이 아니라 JSON을 추가하는 것이 원칙이다.
 * 다만 새 검사가 여기 정의되지 않은 "동작"을 요구하면(예: 새로운 round 단위,
 * 새로운 triage 조건) 코드가 그것을 해석할 줄 알아야 하므로 타입도 함께 넓힌다.
 * 값은 JSON에서, 동작의 종류는 타입에서 관리한다.
 */

/** 출력 레벨 — 판정이 아니라 행동 지시다 (PRD §9.3) */
export type Level = "ok" | "tell" | "call";

/** 타임라인 항목의 종류. 화면에서 색·배지를 가르는 기준이 된다 */
export type TimelineItemKind =
  | "restriction"
  | "fasting"
  | "conditional"
  | "arrival"
  | "exam";

/**
 * 내림 단위 — 반올림은 어떤 경우에도 없다 (PRD §9.2).
 * 모든 시각은 이르게 틀리는 방향으로만 어긋난다.
 */
export type RoundMode = "floor_hour" | "floor_10min";

/** "HH:MM" 24시간 표기 */
export type TimeOfDay = string;

/**
 * triage 조건식 — 코드가 해석한다 (PRD §9.4).
 * 조건 판정과 등급을 분리해, level 값만 JSON에서 바꿀 수 있게 한다.
 */
export type TriageCondition =
  | "fasting.short_unmeasured"
  | "fasting.short"
  | "fasting.short_over_grace"
  | "diabetes.used_unmeasured"
  | "diabetes.after_cutoff"
  | "diabetes.after_cutoff_over_grace"
  | "weight.over_limit";

/** 제한이 시작되는 기준점 */
export type RestrictionFrom = "prev_day_start";

/**
 * 문항이 열리는 시점 — 코드가 해석한다 (PRD §8 F2).
 *
 * 문항마다 답이 성립하는 때가 다르다. 키 · 몸무게는 언제 답해도 같은
 * 값이지만, "6시간 금식 하셨나요?" 를 금식 시작 전에 물으면 **아직
 * 일어나지 않은 일**을 묻는 것이다. 그렇게 받은 답은 당일 사실과
 * 다르고, 그 카드를 접수에 내밀면 서비스가 거짓 안심을 준 것이 된다.
 *
 * 여는 문턱은 **화면에 뜬 값(내림)** 으로 잡는다. 판정선(예약에서
 * 정확히 뺀 값)으로 잠그면, 화면에 "03:00부터" 라고 써 놓고 03:10 에
 * 눌렀을 때 잠기는 모순이 생긴다. 여는 쪽은 이르게 틀리는 것이
 * 안전한 방향이다 (PRD §9.4).
 */
export type AnswerableFrom =
  | "always"
  | "fasting_start"
  | "diabetes_cutoff"
  | "exam_day";

/** 타임라인에서의 표시 방식 */
export type RestrictionDisplay = "all_day";

export interface LocationOption {
  id: string;
  /** 선택 버튼에 쓰는 짧은 이름 */
  label: string;
  /** 타임라인에 쓰는 전체 표기 */
  text: string;
  /**
   * 이 건물 접수처 연락처. 건물마다 다르다.
   *
   * 대표번호로 안내하면 환자가 교환을 거쳐 다시 연결되고, 그 사이에
   * 줄이려던 전화 응대가 오히려 두 번 일어난다.
   */
  phone: string;
}

/**
 * 검사 장소.
 *
 * 건물이 여러 곳이면 서비스가 추측하지 않는다. 환자에게 묻는다.
 * 틀린 건물을 확신 있게 안내하면 환자가 다른 건물까지 걸어갔다 온다.
 */
export interface Locations {
  ask: string;
  hint: string;
  /**
   * 검사를 받을 수 있는 건물 전부.
   *
   * 건물을 모르는 상태를 위한 대체 표기·대체 번호를 두지 않는다.
   * 연락처가 건물마다 다르므로(본관 · 암병원), 모르는 채로 번호를 내면
   * 그건 추측이다. S1 에서 건물 선택이 필수이고, 주소에 건물이 없으면
   * 화면을 그리지 않고 S1 으로 되돌린다.
   */
  options: LocationOption[];
}

/**
 * 낭독 전용 문구 — 있으면 읽어주기가 `text` 대신 이것을 읽는다.
 *
 * 화면과 소리는 같은 내용을 담되 같은 글자일 필요는 없다. 화면은 훑는
 * 것이라 짧은 표기가 낫고, 소리는 흘러가는 것이라 조사와 쉼표가 있어야
 * 문장이 선다. 화면 문구를 소리에 맞춰 늘리면 목록이 무거워지고, 소리를
 * 화면에 맞춰 줄이면 "쓰신다면 이 시각" 처럼 붙어 들린다.
 *
 * `{time}` 을 쓰면 그 자리에 이 항목의 시각이 말로 들어가고, 시각을
 * 따로 읽지 않는다 — "오후 3시. 도착." 대신 "오후 3시까지 오셔야 합니다."
 * 화면에는 시각이 이미 왼쪽에 큰 글씨로 있으므로 이 결합은 소리에만 있다.
 */
type SpeechText = string;

export interface Arrival {
  before_min: number;
  round: RoundMode;
  /** `{location}` 자리에 선택한 건물 표기가 들어간다 */
  text: string;
  /** `{location}` · `{time}` 을 쓸 수 있다 */
  speech_text?: SpeechText;
  /**
   * 도착 항목에 붙는 보조 설명. **한 줄에 한 문장씩** 넣는다.
   *
   * 여러 문장을 "·" 로 이어 붙이면 좁은 화면에서 문장 한가운데가 잘려
   * "혈당 200" 다음이 다음 줄로 넘어가는 식으로 읽힌다.
   *
   * 혈당처럼 **당일 병원이 측정하는 값**은 환자 문답으로 판정할 수 없다.
   * 환자가 자가 체크한 결과로 🟢 를 띄우면 거짓 안심이 된다.
   * 이런 항목은 flags 가 아니라 여기에 사실로 적는다.
   */
  notes?: string[];
}

export interface Exam {
  /** `{duration}` 자리에 소요시간 표기가 들어간다 */
  text: string;
  /** `{duration}` · `{time}` 을 쓸 수 있다 */
  speech_text?: SpeechText;
  /** 구간 목록의 제목. 목록만 나열하면 무엇을 보고 있는지 모른다 */
  phases_title?: string;
  /** 구간 길이 표기. `{duration}` 자리에 길이가 들어간다 */
  phase_duration_text?: string;
  /** 구간의 낭독 문구. `{duration}` · `{text}` 를 쓸 수 있다 */
  phase_speech_text?: SpeechText;
  phases?: ExamPhase[];
}

/**
 * 검사실 안에서의 한 구간 — **길이와 하는 일만** 적는다 (PRD §8 F1).
 *
 * 환자가 "1시간 20분" 을 보고 하는 질문은 "그 시간에 뭘 하는데요" 다.
 * 그 답이 없으면 20분짜리 촬영을 기대하고 와서 대기실에서 되묻는다.
 *
 * **절대 시각을 두지 않는다.** 앞 검사가 밀리면 09:20 은 그냥 틀린
 * 숫자가 되고, 종료 시각을 내림하면 실제보다 **이르게 끝난다고**
 * 알려주는 것이라 원칙 3과 방향이 반대다 (PRD §9.2).
 * 길이는 대기가 밀려도 틀리지 않는다.
 */
export interface ExamPhase {
  id: string;
  /**
   * 구간 길이(분).
   *
   * 합이 `duration_min` 과 같아야 한다 — 두 숫자가 갈리면 환자는 한
   * 화면 안에서 모순을 본다. rules.test.ts 가 잠근다.
   */
  min: number;
  /** 이 구간에 하는 일. 한 줄로 끝나야 훑을 때 걸린다 */
  text: string;
  /**
   * 이 구간만의 낭독 문구. 없으면 `exam.phase_speech_text` 를 쓴다.
   * `{duration}` · `{text}` 를 쓸 수 있다.
   *
   * 화면에서는 구간이 위아래로 놓여 "화장실" 이 어느 시점인지 자리로
   * 보인다. 소리에는 그 배치가 없어서 앞의 대기 50분에 붙은 것처럼
   * 들린다 — 그럴 때 소리 쪽에만 시점을 적어 준다.
   */
  speech_text?: SpeechText;
  /**
   * 접힌 줄의 제목. 이 구간에만 해당하는 주의사항을 연다.
   *
   * "자세히 보기" 처럼 내용을 가리는 말을 쓰지 않는다. 닫힌 채로도
   * 무엇에 관한 것인지는 보여야 열지 말지를 정할 수 있다.
   * 목록을 늘 펴 두면 훑어야 할 줄이 네 배가 된다.
   */
  note_summary?: string;
  /**
   * 접힌 줄의 낭독 문구. 없으면 `note_summary` 를 그대로 읽는다.
   *
   * 화면에서는 이 줄이 **누르는 것**이라 이름만 붙어 있으면 되지만,
   * 소리에는 누를 것이 없다. "대기실 주의사항." 하고 끊기면 다음 문장이
   * 그 주의사항인지 다른 항목인지 알 수 없어, 문장으로 열어 준다.
   */
  note_summary_speech?: SpeechText;
  /** 한 줄에 한 문장씩 (Arrival.notes 와 같은 이유) */
  notes?: string[];
}

export interface Fasting {
  hours: number;
  /**
   * 허용 오차(시간). 기준에 이만큼까지 모자란 것은 등급을 올리지 않는다.
   *
   * 접수 실무에서 5시간 30분 금식과 2시간 금식은 같은 무게가 아니다.
   * 전자까지 전화 안내로 보내면, 줄이려던 그 전화가 늘어난다.
   *
   * 없으면 허용 오차가 0이다 — 기준에 못 미치는 순간 상위 조건이 걸린다.
   */
  grace_h?: number;
  round: RoundMode;
  /** 지시문 */
  text: string;
  /** `{time}` 을 쓸 수 있다 */
  speech_text?: SpeechText;
  /** 보조 설명. 실행 조언이지 판정이 아니다 */
  note?: string;
  /** note를 이 시각 구간에서만 표시한다. 시작 포함, 끝 미포함 */
  note_if_between?: [TimeOfDay, TimeOfDay];
  allowed: string[];
  /** `{items}` 자리에 allowed 가 들어간다 */
  allowed_text: string;
  /** 허용 항목에 붙는 단서 */
  allowed_note?: string;
  forbidden: string[];
  /**
   * `{items}` 자리에 forbidden 이 들어간다.
   *
   * ✕ 같은 기호에 의미를 싣지 않는다. 기호는 읽는 사람마다 다르게 해석되고
   * 스크린리더는 읽지 못한다 (WCAG 1.1.1). 금지는 말로 쓴다.
   */
  forbidden_text: string;
}

export interface ConditionalRule {
  id: string;
  ask: string;
  /** 예약 시각 기준 오프셋(시간). 음수가 과거다 */
  offset_h: number;
  /** 허용 오차(시간). 마지노선을 이만큼까지 넘긴 것은 등급을 올리지 않는다 */
  grace_h?: number;
  round: RoundMode;
  text: string;
  /** `{time}` 을 쓸 수 있다 */
  speech_text?: SpeechText;
  after_text: string;
  /**
   * "예" 라고 답한 환자의 **요약카드에만** 붙는 한 줄.
   *
   * 이 문항에 해당하는 환자에게는 마지노선 말고도 알아야 할 것이 더
   * 있는 경우에 쓴다. 당뇨약이 그렇다 — 시각을 지켜도 접수에서 잰
   * 혈당이 높으면 되돌아간다. 그 사실이 타임라인에만 있으면, 🟢 를 받은
   * 당뇨 환자는 **되돌아갈 실제 사유 1순위를 모른 채 병원에 온다.**
   *
   * 판정이 아니다. 배지를 올리지도 내리지도 않는다 — 사실 한 줄이다.
   */
  card_note?: string;
}

export interface Restriction {
  id: string;
  from: RestrictionFrom;
  display: RestrictionDisplay;
  text: string;
  /** `{time}` 을 쓸 수 있다 */
  speech_text?: SpeechText;
}

/**
 * 문답 문구 — S3 화면이 읽는다.
 *
 * 문항 자체가 검사마다 다르다. FDG PET 은 금식 · 당뇨 · 체중 · 임신이지만
 * 다른 검사는 조영제 알레르기나 신장 수치를 묻는다. 그래서 문구를
 * 컴포넌트가 아니라 여기서 읽는다.
 *
 * 실제 접수에서 반복되는 문답 4종만 담는다 (2026-08-13 확인).
 * 문항을 늘리면 40초 완주 기준을 넘긴다 (WORKFLOW W2 게이트).
 */
export interface QuestionCopy {
  /** 시각을 묻는 모든 문항이 공유한다 */
  time: TimeCopy;
  /** 아직 답할 때가 아닌 문항에 붙는 문구 */
  locked: LockedCopy;
  fasting: {
    /** 없으면 "always" 다 — 언제 답해도 같은 값인 문항 */
    answerable_from?: AnswerableFrom;
    ask: string;
    yes_label: string;
    no_label: string;
    /** "아니요" 를 골랐을 때 이어서 묻는다 */
    time_ask: string;
    /**
     * "아니요" 인데 답한 시각이 오히려 금식을 지킨 시각일 때 되묻는다.
     *
     * 두 답이 어긋난 상태를 서비스가 혼자 정하지 않는다 — 커피 한 잔으로
     * 금식이 깨졌는지는 환자만 안다. `{time}` 은 금식 시작 시각,
     * `{items}` 는 fasting.forbidden 이 들어간다.
     */
    recheck_note: string;
    recheck_ask: string;
    recheck_hint: string;
    recheck_yes: string;
    recheck_no: string;
  };
  diabetes: {
    answerable_from?: AnswerableFrom;
    /** 질문 자체는 conditional.diabetes.ask 를 쓴다. 여기 두면 두 벌이 된다 */
    yes_label: string;
    no_label: string;
    /** "예" 를 골랐을 때 이어서 묻는다 */
    time_ask: string;
  };
  body: {
    answerable_from?: AnswerableFrom;
    ask: string;
    hint: string;
    /** 모르면 접수에서 잰다. 억지로 채우게 하면 틀린 값이 들어온다 */
    unknown_label: string;
    height: NumberField;
    weight: NumberField;
  };
  female: {
    answerable_from?: AnswerableFrom;
    ask: string;
    hint: string;
    yes_label: string;
    no_label: string;
    detail_ask: string;
    /** 세 항목 중 어느 것도 아닌 경우. 빈 채로 넘기는 것과 구분된다 */
    none_label: string;
    day_ask: string;
    day_max: number;
    day_unit: string;
  };
}

/**
 * 아직 답할 때가 아닌 문항 (PRD §8 F2).
 *
 * **막지 않는다.** 기기 시계는 틀릴 수 있고, 대신 답해 주는 보호자도
 * 있다. 강조만 바꾸고 길은 늘 열어 둔다 — `action` 이 그 길이다.
 */
export interface LockedCopy {
  title: string;
  /**
   * 언제부터 답할 수 있는지. `{time}` 자리에 시각이 들어간다.
   *
   * **문장과 나누어 둔다.** 한 줄로 이으면 좁은 화면에서 "답하실 /
   * 수 있습니다" 처럼 어절 한가운데가 갈린다. 여기서 환자가 찾는
   * 것은 시각 하나이므로, 시각이 한 줄에 온전히 서야 훑을 때 걸린다.
   */
  when: string;
  /** 위 줄에 이어지는 문장. 시각을 담지 않는다 */
  when_note: string;
  hint: string;
  /** 그래도 지금 답하겠다는 길 */
  action: string;
  /** 건너뛰고 다음 문항으로. 키 · 몸무게만 미리 답하고 나갈 수 있어야 한다 */
  skip: string;
}

export interface TimeCopy {
  day_label: string;
  yesterday: string;
  today: string;
  hour_label: string;
  minute_label: string;
  /** 분 선택지 간격 */
  minute_step: number;
}

/**
 * 숫자를 직접 받는다 — 키 · 몸무게처럼 본인이 아는 값.
 *
 * 숫자 입력은 자유 텍스트가 아니다. 이름도 증상도 적을 수 없으므로
 * URL · 공유 · 로그 어디에도 원문이 생기지 않는다 (PRD §14).
 * 범위를 벗어난 값은 코드가 막는다.
 */
export interface NumberField {
  label: string;
  unit: string;
  min: number;
  max: number;
  /** 이 값을 넘으면 triage 가 걸린다. 없으면 상한 판정을 하지 않는다 */
  limit?: number;
}

/**
 * 요약카드 문구 — S4 화면이 읽는다 (PRD §8 F2).
 *
 * 카드는 문장이 아니라 [항목 : 값] 표다. 직원이 3초 안에 스캔해야 하므로
 * 값 쪽에 들어갈 말도 짧게 정해 둔다.
 *
 * 항목 순서와 표현은 W1 게이트에서 직원 3명이 확정한다. 그때 코드가
 * 아니라 이 블록만 바뀌어야 한다.
 */
/**
 * S2 에서 문답으로 넘어가는 자리의 문구.
 *
 * 검사 당일인지에 따라 달라진다. 타임라인은 안내문을 받은 날부터 보지만
 * 요약카드는 검사 당일 접수 직전에만 쓸모가 있다. 며칠 전에 만든 카드는
 * 당일 사실과 다르므로, 그때는 문답을 권하지 않는다.
 */
export interface CheckCopy {
  action: string;
  action_today: string;
  note: string;
  /** `{count}` 자리에 문항 수가 들어간다. 숫자를 문구에 박아 두지 않는다 */
  note_today: string;
  /**
   * 검사 당일이지만 **금식이 아직 시작되지 않았을 때.**
   *
   * `{time}` 자리에 금식 시작 시각이 들어간다. 이 상태에서 금식 시작은
   * 반드시 당일이다 — 전날이었다면 이미 지났고, 전날에 열었다면
   * `note` 쪽으로 떨어진다.
   */
  note_early: string;
  /** 지난번 키 · 몸무게를 불러왔을 때 */
  restored: string;
  restored_action: string;
}

/**
 * 전달 기능의 문구 — 공유 · 캘린더 · 읽어주기 (PRD §8 F3).
 *
 * "앱" · "서비스" 같은 말을 쓰지 않는다. 고령 환자에게 진입 장벽이 된다
 * (WORKFLOW T13). 무엇이 일어나는지를 그대로 적는다.
 */
export interface ActionCopy {
  speak: string;
  speak_stop: string;
  calendar: string;
  /** 내려받는 파일 이름의 앞부분. 개인을 가리키는 글자를 넣지 않는다 */
  calendar_file: string;
  share: string;
  /** 공유 시트에 뜨는 제목. 여기에도 의료 판단을 적지 않는다 */
  share_title: string;
  copy: string;
  copied: string;
  /** 복사 기능조차 없는 환경에서 주소를 직접 집게 할 때 */
  copy_manual: string;
}

export interface CardCopy {
  title: string;
  reservation_label: string;
  location_label: string;
  rows: Record<"fasting" | "diabetes" | "body" | "female", string>;
  values: Record<
    | "fasting_kept"
    | "fasting_broken"
    | "none"
    | "unknown"
    | "not_applicable"
    | "unanswered",
    string
  >;
  /** 주의가 필요한 항목을 모아 보여주는 자리의 제목 */
  reasons_title: string;
  /**
   * 언제 답한 것인지. `{time}` 자리에 답한 시각이 들어간다.
   *
   * 날짜만으로는 같은 날 안의 변화를 잡지 못한다. 아침에 만든 🟢 를
   * 오후에 내밀어도 날짜가 같아 그대로 통과한다. **몇 시간이 지나야
   * 오래된 것인지는 판단이므로 하지 않고, 사실만 적는다.**
   */
  answered_at: string;
  /**
   * 답한 뒤로 얼마나 지났는지. `{ago}` 자리에 "3시간 20분" 이 들어간다.
   *
   * 시각만 적으면 직원이 지금 시각과 빼기를 해야 한다. 그 뺄셈을
   * 대신하는 것이 이 서비스가 하는 일이다.
   *
   * **판정이 아니다.** 몇 시간이 지나야 오래된 것인지는 말하지 않는다.
   * 지난 시간은 사실이고, 그것으로 무엇을 할지는 직원이 정한다.
   */
  answered_ago: string;
  /** 문답 없이 카드에 바로 들어온 경우 */
  empty: string;
  empty_action: string;
  /**
   * 답하지 않은 문항이 남아 있는 경우.
   *
   * 배지를 띄우지 않는다. 금식을 아직 답하지 않은 카드에 🟢 가 뜨면,
   * 그건 "묻지 않았다" 를 "해당 없다" 로 바꿔 읽은 것이다 — 이
   * 서비스에서 가장 위험한 방향의 오류다 (PRD §9.4).
   */
  incomplete: string;
  incomplete_hint: string;
  incomplete_action: string;
  /**
   * 검사일이 아닌 날에 답한 카드.
   *
   * 배지를 띄우지 않는다. 며칠 전에 만든 🟢 를 접수에 내밀면 서비스가
   * 거짓 안심을 준 것이 된다. `{date}` 자리에 작성 날짜가 들어간다.
   */
  stale: string;
  stale_hint: string;
  stale_action: string;
}

/**
 * 환자가 스스로 아는 사실. 해당되면 그 자체로 배지가 된다 (PRD §9.4).
 *
 * 혈당처럼 당일 병원이 측정하는 값은 여기에 넣지 않는다.
 * 자가 응답으로 "해당 없음"이 되면 거짓 안심을 준다.
 */
export interface Flag {
  id: string;
  /** 문답 화면에서 고르는 선택지 문구. 환자가 읽는 말이다 */
  q: string;
  /**
   * 요약카드 표에 쓰는 짧은 표기.
   *
   * 카드는 직원이 3초 안에 훑는 [항목 : 값] 표다. "…있습니다" 가 세 개
   * 이어지면 좁은 화면에서 네 줄이 되고, 값이 아니라 문장을 읽게 된다.
   * 환자에게 묻는 말과 직원이 읽는 값은 길이가 달라야 한다.
   */
  short: string;
  level: Level;
}

export interface TriageRule {
  when: TriageCondition;
  level: Level;
  label: string;
}

export interface ExamRuleset {
  id: string;
  label: string;
  /** 계산 기준 타임존. 기기 로컬 타임존을 따르지 않는다 (PRD §9.2) */
  timezone: string;
  duration_min: number;
  /**
   * 타임라인 첫머리 한 줄 안내.
   *
   * 설명 없이 항목부터 나열하면 환자는 무엇을 보고 있는지 모른 채
   * 읽기 시작한다. 목록이 무엇인지 먼저 말해 준다.
   */
  intro: string;
  /**
   * 항목 종류별 라벨. 카드 상단 배지에 쓴다.
   *
   * "이건 금식 얘기" 를 읽기 전에 알 수 있어야, 자기와 상관없는 항목을
   * 건너뛸 수 있다. 안내지가 안 읽히는 이유가 이 구분이 없어서다.
   */
  labels: Record<TimelineItemKind, string>;
  locations: Locations;
  arrival: Arrival;
  exam: Exam;
  fasting: Fasting;
  conditional: ConditionalRule[];
  restrictions: Restriction[];
  /** S3 문답 문구. 문항은 이 블록이 정한다 */
  questions: QuestionCopy;
  /** S2 → S3 진입 문구 */
  check: CheckCopy;
  /** 공유 · 캘린더 · 읽어주기 버튼 문구 */
  actions: ActionCopy;
  /** S4 요약카드 문구 */
  card: CardCopy;
  flags: Flag[];
  /** 없어도 flags 만으로 배지가 판정되어야 한다 (PRD §9.4) */
  triage?: TriageRule[];
  levels: Record<Level, string>;
}

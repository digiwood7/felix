"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import ShareButton from "@/components/ShareButton";
import { loadAnswers } from "@/lib/answers";
import type { StoredAnswers } from "@/lib/answers";
import { decodeAnswersFromHash } from "@/lib/encode";
import { minutesSinceInKST, toKoreanDateLabel } from "@/lib/koreanTime";
import { answerCodes, distanceOf } from "@/lib/logEvent";
import { sendEvent } from "@/lib/logSend";
import type { Answers, TimeAnswer } from "@/lib/questions";
import { buildQuestions, isAnswered } from "@/lib/questions";
import {
  formatLocation,
  formatReservationDate,
  formatReservationTime,
} from "@/lib/reservationLabel";
import type {
  CardCopy,
  ExamRuleset,
  Level,
  LocationOption,
} from "@/lib/rules/types";
import { formatDuration } from "@/lib/schedule";
import type { Reservation, Timeline } from "@/lib/schedule";
import { triage } from "@/lib/triage";
import type { Verdict } from "@/lib/triage";

/**
 * S4 요약카드 — PRD §8 F2
 *
 * 이 제품의 핵심 산출물이다. 환자가 읽는 화면이 아니라 **직원이 3초 안에
 * 스캔하는 화면**이므로 문장이 아니라 [항목 : 값] 표로 만든다.
 *
 * 판정은 lib/triage.ts 가, 문구는 룰셋이 정한다. 여기서는 그리기만 한다.
 * 화면에 문장을 새로 만들지 않는다 — 출력은 룰셋 levels 의 행동 지시
 * 3종뿐이고, 검사를 받을 수 있는지 없는지는 어떤 형태로도 말하지 않는다.
 *
 * 응답은 두 곳에서 온다. **주소 조각이 먼저다** (T9).
 *   `#a=` 에 실려 온 답  → 다른 기기 · 다른 브라우저에서도 같은 카드
 *   기기에 남은 답        → 같은 기기에서 뒤로 갔다 오는 길
 *
 * 조각은 서버로 전송되지 않으므로 서버에서는 읽을 수 없다. 그래서 답은
 * 마운트 후에야 정해진다 — 이 화면이 클라이언트 컴포넌트인 이유다.
 */
export default function SummaryCard({
  ruleset,
  reservation,
  timeline,
  location,
  checkHref,
}: {
  ruleset: ExamRuleset;
  reservation: Reservation;
  timeline: Timeline;
  /** 검사받을 건물. 배지의 접수처 연락처가 여기서 나온다 */
  location: LocationOption;
  checkHref: string;
}) {
  const [stored, setStored] = useState<StoredAnswers | null>(null);
  const [loaded, setLoaded] = useState(false);
  const logged = useRef(false);

  useEffect(() => {
    // 주소 조각이 먼저다. 없거나 형식이 어긋날 때만 기기에 남은 답을 본다
    setStored(
      decodeAnswersFromHash(ruleset, window.location.hash) ?? loadAnswers(),
    );
    setLoaded(true);
  }, [ruleset]);

  /**
   * S4 도달 기록 — PRD §8 F4
   *
   * 답을 읽은 뒤라야 배지와 응답 코드가 정해지므로 LogView 를 쓰지 않고
   * 여기서 보낸다. 카드가 그려지지 않은 경우(답이 없거나 지난 날 답)도
   * 도달은 도달이다 — 그때는 배지 없이 화면만 남긴다. 여기서 빼 버리면
   * "카드까지 왔는데 빈 카드를 봤다" 가 깔때기에서 사라진다.
   *
   * **주소 조각(#a=)은 서버로 가지 않고, 여기서 보내는 것도 원문이 아니라
   * 룰셋이 아는 카테고리 코드뿐이다.**
   */
  useEffect(() => {
    if (!loaded || logged.current) return;
    logged.current = true;

    const examDate = `${reservation.year}-${pad(reservation.month)}-${pad(reservation.day)}`;
    // 검사일이 아닌 날에 답한 카드는 배지를 띄우지 않는다. 로그도 같다
    const fresh = stored?.savedOn === examDate ? stored : null;

    sendEvent({
      screen: "s4",
      rel: distanceOf(examDate),
      badge: fresh
        ? triage({
            ruleset,
            answers: fresh.answers,
            reservation,
            location,
          }).level
        : null,
      answers: fresh ? answerCodes(ruleset, fresh.answers) : null,
    });
  }, [loaded, stored, ruleset, reservation, timeline, location]);

  const card = ruleset.card;

  if (!loaded) return null;

  if (!stored) {
    return (
      <Notice
        message={card.empty}
        action={card.empty_action}
        href={checkHref}
      />
    );
  }

  /**
   * 검사일이 아닌 날에 답한 카드는 배지를 띄우지 않는다.
   *
   * 금식 · 복약 시각 · 생리 여부는 당일 사실이다. 며칠 전에 만든 🟢 를
   * 접수에 내밀면 서비스가 거짓 안심을 준 것이 되고, 이 프로젝트가
   * 얻어야 할 신뢰를 정확히 반대로 깎는다.
   *
   * 답을 지우지는 않는다. 다시 답할지는 환자가 정한다.
   */
  const examDate = `${reservation.year}-${pad(reservation.month)}-${pad(reservation.day)}`;
  if (stored.savedOn !== examDate) {
    return (
      <Notice
        message={card.stale.replace(
          "{date}",
          toKoreanDateLabel(stored.savedOn),
        )}
        hint={card.stale_hint}
        action={card.stale_action}
        href={checkHref}
      />
    );
  }

  /**
   * 답하지 않은 문항이 남아 있으면 배지를 띄우지 않는다.
   *
   * 아직 답할 때가 아닌 문항은 건너뛸 수 있다(QuestionFlow). 그 길로
   * 만든 카드에 🟢 가 뜨면, "묻지 않았다" 가 "해당 없다" 로 바뀌어
   * 읽힌다 — 금식을 답하지 않은 환자가 안심하고 병원에 온다.
   * 이 방향의 오류가 이 서비스에서 가장 위험하다 (PRD §9.4).
   *
   * 답을 지우지는 않는다. 키 · 몸무게는 기기에 남아 다시 묻지 않는다.
   */
  if (buildQuestions(ruleset).some((q) => !isAnswered(q, stored.answers))) {
    return (
      <Notice
        message={card.incomplete}
        hint={card.incomplete_hint}
        action={card.incomplete_action}
        href={checkHref}
      />
    );
  }

  const answers = stored.answers;
  const verdict = triage({
    ruleset,
    answers,
    reservation,
    location,
  });

  return (
    <div>
      {/* 무엇에 대한 카드인지 먼저. 직원은 여러 환자의 화면을 연달아 본다 */}
      <header className="rounded-t-2xl bg-slate-900 px-5 py-4 text-white">
        <p className="text-[1.06rem] font-medium text-slate-300">
          {ruleset.label}
        </p>
        <p className="mt-1 text-[1.35rem] leading-tight font-extrabold">
          {formatReservationDate(reservation)}{" "}
          {formatReservationTime(reservation)}
        </p>
        <p className="mt-1 text-[1.06rem] text-slate-300">
          {formatLocation(location)}
        </p>
      </header>

      <Badge verdict={verdict} />

      {/* 언제 답한 것인지 — **배지와 표 사이에 둔다.**
          직원의 시선은 예약 시각 → 배지 → 표로 간다. 헤더 맨 아랫줄
          검은 바탕의 흐린 회색으로 두면 그 동선 밖이라 읽히지 않는다.
          아침에 만든 🟢 를 오후에 내밀어도 배지는 그대로이므로,
          알아채는 일이 여기 한 줄에 걸려 있다 */}
      <AnsweredAt copy={card} savedOn={stored.savedOn} savedAt={stored.savedAt} />

      <dl className="divide-y-2 divide-slate-200 rounded-b-2xl border-2 border-t-0 border-slate-300">
        <Row label={card.rows.fasting} value={fastingValue(ruleset, answers)} />
        <Row
          label={card.rows.diabetes}
          value={diabetesValue(ruleset, answers)}
        />
        <Row label={card.rows.body} value={bodyValue(ruleset, answers)} />
        <Row label={card.rows.female} value={femaleValue(ruleset, answers)} />
      </dl>

      {/* 해당하는 환자에게만 붙는 사실 한 줄.
          당뇨약은 시각을 지켜도 접수에서 잰 혈당이 높으면 되돌아간다.
          그 사실이 타임라인에만 있으면 🟢 를 받은 당뇨 환자는 되돌아갈
          실제 사유를 모른 채 온다. 판정이 아니므로 배지를 건드리지 않고,
          주의 항목 위에 둔다 — 배지를 올린 사유와 섞이면 안 된다 */}
      {conditionalNotes(ruleset, answers).map((note) => (
        <p
          key={note}
          className="mt-4 rounded-xl border-2 border-slate-300 bg-slate-50 px-4 py-3 text-[1.06rem] leading-snug text-slate-700"
        >
          {note}
        </p>
      ))}

      {/* 주의가 필요한 항목만 다시 모은다. 위 표를 다시 읽지 않아도 되게 */}
      {verdict.reasons.length > 0 && (
        <section className="mt-4">
          <h2 className="mb-2 text-[1.12rem] font-bold text-slate-900">
            {card.reasons_title}
          </h2>
          <ul className="flex flex-col gap-2">
            {verdict.reasons.map((reason) => (
              <li
                key={reason.label}
                className={`flex items-start gap-2 rounded-xl border-2 px-4 py-3 text-[1.12rem] leading-snug font-bold ${
                  STYLE[reason.level].box
                }`}
              >
                <Mark level={reason.level} />
                {reason.label}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 카드가 끝난 뒤에 둔다. 표와 주의 항목 사이에 끼우면 직원이 훑는
          한 덩어리가 갈라진다.
          보호자가 만들어 환자에게 보내는 것이 실제 확산 경로이고(PRD §5),
          주소에 답이 담겨 있어 받은 사람도 같은 카드를 본다 */}
      <div className="mt-6 flex">
        <ShareButton copy={ruleset.actions} />
      </div>
    </div>
  );
}

/**
 * 색 · 아이콘 · 텍스트 3중 표기 (PRD §13).
 *
 * 색만으로 등급을 나누면 색각 이상 사용자와 흑백 출력에서 사라진다.
 * 아이콘도 등급마다 **모양이 다르다** — 같은 원에 색만 다르면 3중 표기가
 * 아니라 색 하나에 기댄 표기다.
 */
const STYLE: Record<Level, { box: string; mark: string }> = {
  ok: {
    box: "border-emerald-700 bg-emerald-50 text-emerald-900",
    mark: "text-emerald-700",
  },
  tell: {
    box: "border-amber-700 bg-amber-50 text-amber-900",
    mark: "text-amber-700",
  },
  call: {
    box: "border-red-700 bg-red-50 text-red-900",
    mark: "text-red-700",
  },
};

function Badge({ verdict }: { verdict: Verdict }) {
  return (
    <div
      // 배지가 카드의 일부로 읽히도록 머리글에 붙여 둔다
      className={`flex items-start gap-3 border-x-2 border-b-2 px-5 py-4 ${STYLE[verdict.level].box}`}
    >
      <Mark level={verdict.level} big />
      <p className="text-[1.24rem] leading-snug font-extrabold">
        {verdict.message}
      </p>
    </div>
  );
}

/**
 * 답한 시각과 그 뒤로 지난 시간.
 *
 * **"3시간 20분 전" 이 앞에 온다.** 시각만 적으면 직원이 지금 시각과
 * 빼기를 해야 하는데, 그 뺄셈을 대신하는 것이 이 서비스가 하는 일이다.
 * 절대 시각도 함께 남긴다 — "그 뒤로 드신 것 없으시죠?" 를 물으려면
 * 기준점이 필요하다.
 *
 * **판정하지 않는다.** 몇 시간이 지나야 오래된 것인지는 값이 아니라
 * 판단이고, 이 서비스는 판단하지 않는다 (원칙 2). 색도 바꾸지 않는다.
 *
 * 카드를 열어 둔 채 줄에 서 있을 수 있으므로 1분마다 다시 잰다.
 * 서버에는 "지금" 이 없어 마운트 후에야 값이 생긴다.
 */
function AnsweredAt({
  copy,
  savedOn,
  savedAt,
}: {
  copy: CardCopy;
  /** "YYYY-MM-DD" */
  savedOn: string;
  /** "HH:MM" */
  savedAt: string;
}) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const minutes = now === null ? null : minutesSinceInKST(savedOn, savedAt, now);
  // 1분 미만이면 적을 것이 없다. 기기 시계가 뒤로 가 있으면 음수가 나온다
  const ago = minutes !== null && minutes >= 1 ? formatDuration(minutes) : null;

  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-x-2 border-b-2 border-slate-300 bg-white px-5 py-3">
      {ago && (
        <span className="text-[1.12rem] font-extrabold text-slate-900">
          {copy.answered_ago.replace("{ago}", ago)}
        </span>
      )}
      <span className="text-[1.06rem] text-slate-700">
        {copy.answered_at.replace("{time}", savedAt)}
      </span>
    </div>
  );
}

/** 등급마다 모양이 다른 표식. 스크린리더에는 등급 이름을 그대로 읽힌다 */
function Mark({ level, big = false }: { level: Level; big?: boolean }) {
  const size = big ? "h-8 w-8" : "h-6 w-6";
  const label = { ok: "확인", tell: "알림", call: "전화" }[level];

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox="0 0 24 24"
      className={`${size} ${STYLE[level].mark} shrink-0`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {level === "ok" && (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M8 12.5l2.5 2.5L16 9.5" />
        </>
      )}
      {level === "tell" && (
        <>
          <path d="M12 3.5L21.5 20H2.5z" />
          <path d="M12 10v4M12 17.2v.1" />
        </>
      )}
      {level === "call" && (
        <path d="M6.5 3.5h3l1.5 4-2 1.5a12 12 0 006 6l1.5-2 4 1.5v3a2 2 0 01-2.2 2A17 17 0 014.5 5.7a2 2 0 012-2.2z" />
      )}
    </svg>
  );
}

/** 카드 대신 보여주는 안내 — 답이 없거나, 오늘 답이 아닐 때 */
function Notice({
  message,
  hint,
  action,
  href,
}: {
  message: string;
  hint?: string;
  action: string;
  href: string;
}) {
  return (
    <div className="rounded-2xl border-2 border-slate-500 px-5 py-6">
      <p className="text-[1.18rem] leading-relaxed font-bold text-slate-900">
        {message}
      </p>
      {hint && (
        <p className="mt-2 text-[1.06rem] leading-snug text-slate-600">
          {hint}
        </p>
      )}
      <Link
        href={href}
        className="mt-4 flex min-h-[60px] items-center justify-center rounded-2xl bg-slate-900 px-5 text-center text-[1.24rem] font-bold text-white"
      >
        {action}
      </Link>
    </div>
  );
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-5 py-3">
      <dt className="w-[7.5rem] shrink-0 text-[1.06rem] font-medium text-slate-600">
        {label}
      </dt>
      <dd className="min-w-0 flex-1 text-[1.24rem] leading-snug font-extrabold text-slate-900">
        {value}
      </dd>
    </div>
  );
}

/** 값 문구는 전부 룰셋에서 온다. 화면에 문장을 만들어 넣지 않는다 */

function fastingValue(ruleset: ExamRuleset, a: Answers): string {
  const v = ruleset.card.values;
  if (!a.fasting) return v.unanswered;
  if (a.fasting.kept) return v.fasting_kept;
  const when = a.fasting.time ? ` · ${timeText(ruleset, a.fasting.time)}` : "";
  return `${v.fasting_broken}${when}`;
}

/**
 * "예" 라고 답한 조건 문항의 카드 문구.
 *
 * 룰셋에 `card_note` 가 없으면 아무것도 붙지 않는다 — 검사 종류가 늘어도
 * 여기는 그대로다. 조건 문항의 응답이 `answers.diabetes` 한 자리뿐이라
 * id 로 잇는 것은 `lib/triage.ts` 의 `usesDiabetes` 와 같은 방식이다.
 */
function conditionalNotes(ruleset: ExamRuleset, a: Answers): string[] {
  return ruleset.conditional
    .filter((c) => c.card_note && c.id === "diabetes" && a.diabetes?.uses)
    .map((c) => c.card_note!);
}

function diabetesValue(ruleset: ExamRuleset, a: Answers): string {
  const v = ruleset.card.values;
  if (!a.diabetes) return v.unanswered;
  if (!a.diabetes.uses) return v.none;
  return a.diabetes.time ? timeText(ruleset, a.diabetes.time) : v.unanswered;
}

function bodyValue(ruleset: ExamRuleset, a: Answers): string {
  const v = ruleset.card.values;
  const { height, weight } = ruleset.questions.body;
  if (a.body.unknown) return v.unknown;
  if (a.body.height === null || a.body.weight === null) return v.unanswered;
  return `${a.body.height}${height.unit} · ${a.body.weight}${weight.unit}`;
}

function femaleValue(ruleset: ExamRuleset, a: Answers): string {
  const v = ruleset.card.values;
  if (!a.female) return v.unanswered;
  if (!a.female.applies) return v.not_applicable;

  // 표에는 짧은 표기를 쓴다. 묻는 말("…있습니다")을 그대로 값 자리에
  // 넣으면 세 항목이 네 줄이 되어 직원이 훑지 못한다
  const labels = ruleset.flags
    .filter((f) => a.female!.checks.includes(f.id))
    .map((f) => {
      const day = a.female!.menstrualDay;
      // 생리 항목에만 일수가 붙는다. 어느 항목인지는 룰셋 id 로 안다
      return f.id === "menstruation" && day !== null
        ? `${f.short} (${day}${ruleset.questions.female.day_unit})`
        : f.short;
    });

  return labels.length > 0 ? labels.join(" · ") : v.not_applicable;
}

/** "어제 21:30" — 날짜 낱말도 룰셋에서 읽는다 */
function timeText(ruleset: ExamRuleset, t: TimeAnswer): string {
  const copy = ruleset.questions.time;
  const day = t.day === "yesterday" ? copy.yesterday : copy.today;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${day} ${pad(t.hour)}:${pad(t.minute)}`;
}

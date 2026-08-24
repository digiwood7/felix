"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { daysUntilInKST, isBeforeInKST } from "@/lib/koreanTime";
import type { CheckCopy } from "@/lib/rules/types";

/**
 * S2 → S3 진입 — 문답이 지금 성립하는지에 따라 다르게 보여준다.
 *
 * 타임라인은 안내문을 받은 날부터 며칠에 걸쳐 본다. 요약카드는 검사 당일
 * 접수 직전에만 쓸모가 있다. 문답 4개 중 셋(금식 · 복약 시각 · 생리
 * 여부)이 **당일 사실**이기 때문이다.
 *
 * 그래서 세 갈래다.
 *
 *   later — 검사일이 남았다. 며칠 전에 만든 카드를 접수에 내밀면
 *           서비스가 거짓 안심을 준 것이 된다
 *   early — 당일이지만 **금식이 아직 시작되지 않았다.** 이때
 *           "6시간 금식 하셨나요?" 는 아직 일어나지 않은 일을 묻는다.
 *           17:30 예약이면 금식 시작이 11:00 인데, 앱이 권하는 대로
 *           아침 8시에 답하면 환자는 답할 수 없는 질문을 받는다
 *   today — 답할 수 있다
 *
 * **막지는 않는다.** 기기 시계는 틀릴 수 있고, 대신 답해 주는 보호자도
 * 있다. 강조만 바꾸고 길은 늘 열어 둔다.
 */
type Stage = "today" | "early" | "later";

export default function CheckCta({
  copy,
  href,
  examDate,
  questionCount,
  fastingStart,
}: {
  copy: CheckCopy;
  href: string;
  /** 검사일 "YYYY-MM-DD" */
  examDate: string;
  questionCount: number;
  /**
   * 타임라인에 뜬 금식 시작 — `{ date: "2026-08-24", time: "11:00" }`.
   *
   * **내림된 표시값 그대로다.** 판정선(예약 −6시간)이 아니다 — 이 문구는
   * "언제 답하면 되는지" 를 알려 주는 안내이고, 바로 위 타임라인에 뜬
   * 것과 같은 숫자여야 환자가 두 숫자를 대조하지 않는다 (PRD §9.4).
   *
   * 없으면 금식 시작을 모르는 것이므로 early 를 가리지 않는다.
   */
  fastingStart?: { date: string; time: string };
}) {
  // 서버에는 "지금" 이 없다. 마운트 후에 정하고, 그 전에는 당일 모습으로
  // 그린다 — 잘못 그려도 문답으로 가는 길이 좁아지지 않는 쪽이다
  const [stage, setStage] = useState<Stage>("today");

  useEffect(() => {
    if (daysUntilInKST(examDate) !== 0) {
      setStage("later");
      return;
    }
    setStage(
      fastingStart && isBeforeInKST(fastingStart.date, fastingStart.time)
        ? "early"
        : "today",
    );
  }, [examDate, fastingStart?.date, fastingStart?.time]);

  if (stage === "today") {
    return (
      <>
        <Link
          href={href}
          className="mt-8 flex min-h-[64px] items-center justify-center rounded-2xl bg-slate-900 px-5 text-center text-[1.24rem] font-bold text-white"
        >
          {copy.action_today}
        </Link>
        <p className="mt-2 text-center text-[1.06rem] leading-snug text-slate-600">
          {copy.note_today.replace("{count}", String(questionCount))}
        </p>
      </>
    );
  }

  return (
    <>
      {/* 아직 답할 때가 아니면 버튼을 낮춘다. 없애지는 않는다 */}
      <Link
        href={href}
        className="mt-8 flex min-h-[60px] items-center justify-center rounded-2xl border-2 border-slate-500 px-5 text-center text-[1.12rem] font-bold text-slate-700"
      >
        {copy.action}
      </Link>
      <p className="mt-2 text-center text-[1.06rem] leading-snug text-slate-600">
        {stage === "early" && fastingStart
          ? copy.note_early.replace("{time}", fastingStart.time)
          : copy.note}
      </p>
    </>
  );
}

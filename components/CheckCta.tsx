"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { daysUntilInKST } from "@/lib/koreanTime";
import type { CheckCopy } from "@/lib/rules/types";

/**
 * S2 → S3 진입 — 검사 당일인지에 따라 다르게 보여준다.
 *
 * 타임라인은 안내문을 받은 날부터 며칠에 걸쳐 본다. 요약카드는 검사 당일
 * 접수 직전에만 쓸모가 있다. 문답 4개 중 셋(금식 · 복약 시각 · 생리
 * 여부)이 **당일 사실**이기 때문이다.
 *
 * 그래서 검사일이 남았으면 문답을 권하지 않는다. 며칠 전에 만든 카드를
 * 접수에 내밀면 서비스가 거짓 안심을 준 것이 된다.
 *
 * **막지는 않는다.** 기기 시계는 틀릴 수 있고, 대신 답해 주는 보호자도
 * 있다. 강조만 바꾸고 길은 늘 열어 둔다.
 */
export default function CheckCta({
  copy,
  href,
  examDate,
  questionCount,
}: {
  copy: CheckCopy;
  href: string;
  /** 검사일 "YYYY-MM-DD" */
  examDate: string;
  questionCount: number;
}) {
  // 서버에는 "오늘" 이 없다. 마운트 후에 정하고, 그 전에는 당일 모습으로
  // 그린다 — 잘못 그려도 문답으로 가는 길이 좁아지지 않는 쪽이다
  const [isToday, setIsToday] = useState(true);

  useEffect(() => {
    setIsToday(daysUntilInKST(examDate) === 0);
  }, [examDate]);

  if (isToday) {
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
      {/* 검사일이 남았을 때는 버튼을 낮춘다. 없애지는 않는다 */}
      <Link
        href={href}
        className="mt-8 flex min-h-[60px] items-center justify-center rounded-2xl border-2 border-slate-500 px-5 text-center text-[1.12rem] font-bold text-slate-700"
      >
        {copy.action}
      </Link>
      <p className="mt-2 text-center text-[1.06rem] leading-snug text-slate-600">
        {copy.note}
      </p>
    </>
  );
}

"use client";

import { useEffect, useRef } from "react";

import { distanceOf, type Screen } from "@/lib/logEvent";
import { sendEvent } from "@/lib/logSend";

/**
 * 화면 도달 기록 — PRD §8 F4
 *
 * 아무것도 그리지 않는다. 화면에 놓기만 하면 도달이 한 번 기록된다.
 *
 * 이탈 지점은 화면별 도달 수의 차이로 읽는다. S2 는 100인데 S3 이 40이면
 * 타임라인에서 문답으로 넘어가는 자리가 새는 것이다. 사람을 따라가지
 * 않고도 깔때기는 그려지고, 따라가지 않으므로 이을 값도 필요 없다.
 *
 * 요약카드(S4)는 여기를 쓰지 않는다 — 배지와 응답 코드가 답을 읽은
 * 뒤에야 정해지므로 SummaryCard 가 직접 보낸다.
 */
export default function LogView({
  screen,
  examDate,
}: {
  screen: Screen;
  /** "2026-08-06". 예약을 아직 모르는 S1 에서는 넘기지 않는다 */
  examDate?: string;
}) {
  const sent = useRef(false);

  useEffect(() => {
    // 개발 모드의 StrictMode 는 effect 를 두 번 부른다. 두 번 세지 않는다
    if (sent.current) return;
    sent.current = true;

    sendEvent({
      screen,
      rel: examDate ? distanceOf(examDate) : null,
      badge: null,
      answers: null,
    });
  }, [screen, examDate]);

  return null;
}

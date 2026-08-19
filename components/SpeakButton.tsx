"use client";

import { useEffect, useRef, useState } from "react";

import ActionButton from "@/components/ActionButton";
import type { ActionCopy } from "@/lib/rules/types";

/**
 * 읽어주기 — PRD §8 F3
 *
 * 고령 환자는 읽기보다 듣기가 쉽다. 브라우저에 들어 있는 기능이라
 * 서버도 비용도 없다.
 *
 * **한국어 음성이 없으면 버튼 자체를 그리지 않는다.** 눌러도 소리가 안
 * 나는 버튼은 고령 사용자에게 "고장난 화면" 으로 읽히고, 그 인상은 화면
 * 전체로 번진다. 안드로이드는 기기별로 한국어 음성이 없는 경우가 있다.
 */
export default function SpeakButton({
  script,
  copy,
}: {
  /** lib/speech.ts 가 만든 원고. 화면에 보이는 것과 같은 내용이다 */
  script: string;
  copy: ActionCopy;
}) {
  const [hasVoice, setHasVoice] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const synthRef = useRef<SpeechSynthesis | null>(null);

  useEffect(() => {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synthRef.current = synth;

    /**
     * 음성 목록은 늦게 채워진다. 처음 한 번으로 판단하면 있는 기기에서도
     * 버튼이 사라진다. voiceschanged 를 함께 듣는다.
     */
    const check = () => {
      setHasVoice(
        synth.getVoices().some((v) => v.lang?.toLowerCase().startsWith("ko")),
      );
    };

    check();
    synth.addEventListener("voiceschanged", check);

    return () => {
      synth.removeEventListener("voiceschanged", check);
      // 화면을 떠나면 멈춘다. 안 그러면 다음 화면에서 소리만 계속 난다
      synth.cancel();
    };
  }, []);

  function stop() {
    synthRef.current?.cancel();
    setSpeaking(false);
  }

  function start() {
    const synth = synthRef.current;
    if (!synth) return;

    synth.cancel();

    /**
     * 통째로 넘기지 않고 문장 단위로 끊어 넣는다.
     *
     * 긴 문장 하나를 넘기면 중간에 끊기는 브라우저가 있다. 끊어 넣으면
     * 그 문제를 피하면서 문장 사이 쉬는 자리도 자연스러워진다.
     */
    const parts = script.split(". ");
    const chunks = parts.map((part, i) =>
      i < parts.length - 1 ? `${part}.` : part,
    );

    chunks.forEach((chunk, i) => {
      const utterance = new SpeechSynthesisUtterance(chunk);
      utterance.lang = "ko-KR";
      // 조금 느리게. 이 화면의 독자는 처음 듣는 지시를 받아 적는 사람이다
      utterance.rate = 0.95;
      if (i === chunks.length - 1) {
        utterance.onend = () => setSpeaking(false);
      }
      utterance.onerror = () => setSpeaking(false);
      synth.speak(utterance);
    });

    setSpeaking(true);
  }

  if (!hasVoice) return null;

  return (
    <ActionButton
      onClick={speaking ? stop : start}
      label={speaking ? copy.speak_stop : copy.speak}
      active={speaking}
    >
      {speaking ? (
        <>
          <rect x="7.5" y="6" width="3" height="12" rx="1" />
          <rect x="13.5" y="6" width="3" height="12" rx="1" />
        </>
      ) : (
        <path d="M8 5.5l9.5 6.5-9.5 6.5z" />
      )}
    </ActionButton>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";

import ActionButton from "@/components/ActionButton";
import type { ActionCopy } from "@/lib/rules/types";

/**
 * 읽어주기 — PRD §8 F3
 *
 * 고령 환자는 읽기보다 듣기가 쉽다.
 *
 * 소리는 두 벌이다.
 *   1순위: 미리 더빙해 둔 조각(public/audio/, lib/speechAudio.ts) —
 *          사람 목소리라 기계 낭독보다 잘 들린다.
 *   폴백:  브라우저 내장 TTS(lib/speech.ts 원고) — 조각이 없거나(날짜
 *          풀 범위 밖, 5분 단위가 아닌 시각) 로드가 실패하면 이쪽으로.
 *
 * 버튼은 어느 한 벌이라도 소리를 낼 수 있을 때만 그린다. 눌러도 소리가
 * 안 나는 버튼은 고령 사용자에게 "고장난 화면" 으로 읽히고, 그 인상은
 * 화면 전체로 번진다.
 */
/**
 * 폴백 TTS 의 읽는 속도. 1 이 기본이고 낮을수록 느리다.
 *
 * 이 화면의 독자는 처음 듣는 지시를 받아 적는 사람이고, 대부분 고령이다.
 * 기본 속도로는 "오전 9시" 를 듣고 적는 사이에 다음 문장이 지나간다.
 * (더빙 조각은 생성할 때 이미 0.8 배속으로 만들어져 있다)
 */
const RATE = 0.7;

/**
 * 날짜가 바뀔 때 쉬는 길이.
 *
 * 화면에서는 날짜 경계가 빈 줄과 굵은 글씨로 보이지만 소리에는 그것이
 * 없다. 여기서 쉬지 않으면 전날 할 일과 검사 당일 할 일이 한 덩어리로
 * 들린다 — 이 서비스가 없애려는 바로 그 혼동이다. 더빙 · 폴백 공통이다.
 */
const BLOCK_PAUSE_MS = 800;

export default function SpeakButton({
  blocks,
  audioBlocks,
  copy,
}: {
  /**
   * lib/speech.ts 가 만든 원고. 화면에 보이는 것과 같은 내용이다.
   * 한 도막이 하루치이고, 도막 사이에서 쉰다.
   */
  blocks: string[];
  /**
   * lib/speechAudio.ts 가 만든 더빙 조각 목록. 원고와 같은 도막 구조다.
   * 없으면(구버전 호출) 폴백 TTS 만 쓴다.
   */
  audioBlocks?: string[][];
  copy: ActionCopy;
}) {
  const [hasVoice, setHasVoice] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  /**
   * 재생에 쓰는 단 하나의 Audio.
   *
   * iOS 는 손이 닿은 순간에 시작한 소리만 허용한다. 클릭 안에서 재생을
   * 시작한 엘리먼트는 그 뒤로 src 를 바꿔 이어 재생할 수 있으므로,
   * 조각마다 새로 만들지 않고 하나를 돌려 쓴다.
   */
  const audioRef = useRef<HTMLAudioElement | null>(null);
  /**
   * 지금 읽고 있는 회차. 멈추거나 다시 시작하면 올라간다.
   *
   * 도막 사이를 기다리는 동안 사용자가 멈출 수 있다. 회차가 바뀐 뒤에
   * 깨어난 타이머는 아무 일도 하지 않는다 — 안 그러면 멈춘 뒤에 다음
   * 날짜가 혼자 읽히기 시작한다.
   */
  const runRef = useRef(0);
  const timerRef = useRef<number | null>(null);

  const hasAudio = (audioBlocks?.length ?? 0) > 0;

  useEffect(() => {
    const synth = window.speechSynthesis;
    if (synth) {
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
        runRef.current += 1;
        if (timerRef.current !== null) window.clearTimeout(timerRef.current);
        synth.cancel();
        audioRef.current?.pause();
      };
    }

    return () => {
      runRef.current += 1;
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      audioRef.current?.pause();
    };
  }, []);

  function stop() {
    runRef.current += 1;
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    synthRef.current?.cancel();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
    setSpeaking(false);
  }

  function start() {
    setSpeaking(true);
    const run = ++runRef.current;

    if (hasAudio) {
      // 첫 조각은 누른 그 자리에서 재생을 시작해야 한다 (iOS)
      playChunk(0, 0, run);
      return;
    }

    startSynth(run);
  }

  /** ---------- 1순위: 더빙 조각 ---------- */

  function playChunk(blockIndex: number, chunkIndex: number, run: number) {
    if (run !== runRef.current || !audioBlocks) return;

    const block = audioBlocks[blockIndex];
    if (block === undefined) {
      setSpeaking(false);
      return;
    }

    const src = block[chunkIndex];
    if (src === undefined) {
      // 한 도막이 끝났다. 한 템포 쉬고 다음 날짜로 넘어간다
      timerRef.current = window.setTimeout(
        () => playChunk(blockIndex + 1, 0, run),
        BLOCK_PAUSE_MS,
      );
      return;
    }

    const audio = audioRef.current ?? new Audio();
    audioRef.current = audio;

    audio.onended = () => {
      if (run === runRef.current) playChunk(blockIndex, chunkIndex + 1, run);
    };
    /**
     * 조각이 없거나(404) 재생이 막히면 폴백 TTS 로 처음부터 다시 읽는다.
     *
     * 중간부터 이어 읽지 않는다 — 어디까지 들렸는지 알 수 없고, 목소리가
     * 중간에 바뀌면 듣는 사람은 화면이 고장났다고 느낀다. 처음부터가
     * 오히려 덜 혼란스럽다.
     */
    const fallback = () => {
      if (run !== runRef.current) return;
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
      startSynth(run);
    };
    audio.onerror = fallback;

    audio.src = src;
    audio.play().catch(fallback);
  }

  /** ---------- 폴백: 브라우저 TTS ---------- */

  function startSynth(run: number) {
    const synth = synthRef.current;
    if (!synth || !hasVoice) {
      if (run === runRef.current) setSpeaking(false);
      return;
    }
    synth.cancel();
    speakBlock(0, run);
  }

  function speakBlock(index: number, run: number) {
    const synth = synthRef.current;
    if (!synth || run !== runRef.current) return;

    const block = blocks[index];
    if (block === undefined) {
      setSpeaking(false);
      return;
    }

    /**
     * 도막을 통째로 넘기지 않고 문장 단위로 끊어 넣는다.
     *
     * 긴 문장 하나를 넘기면 중간에 끊기는 브라우저가 있다. 끊어 넣으면
     * 그 문제를 피하면서 문장 사이 쉬는 자리도 자연스러워진다.
     */
    const parts = block.split(". ");
    const chunks = parts.map((part, i) =>
      i < parts.length - 1 ? `${part}.` : part,
    );

    chunks.forEach((chunk, i) => {
      const utterance = new SpeechSynthesisUtterance(chunk);
      utterance.lang = "ko-KR";
      utterance.rate = RATE;
      if (i === chunks.length - 1) {
        // 한 도막이 끝났다. 한 템포 쉬고 다음 날짜로 넘어간다
        utterance.onend = () => {
          if (run !== runRef.current) return;
          timerRef.current = window.setTimeout(
            () => speakBlock(index + 1, run),
            BLOCK_PAUSE_MS,
          );
        };
      }
      utterance.onerror = () => {
        if (run === runRef.current) setSpeaking(false);
      };
      synth.speak(utterance);
    });
  }

  if (!hasAudio && !hasVoice) return null;

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

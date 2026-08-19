"use client";

import ActionButton from "@/components/ActionButton";
import type { ActionCopy } from "@/lib/rules/types";

/**
 * 캘린더 등록 — PRD §8 F3
 *
 * 이 서비스는 발송 서버가 없다. 알림을 보낼 방법이 하나뿐인데, 기기
 * 캘린더에 넣어 두고 기기가 울리게 하는 것이다.
 *
 * 이것이 종이 안내지의 가장 큰 실패를 메운다. 안내지는 D-30 에 받는데
 * 정보가 필요한 순간은 D-1 저녁과 D-day 새벽이고, 그때 종이는 손에 없다
 * (PRD §2.2). 캘린더 알림은 바로 그 시각에 울린다.
 */
export default function CalendarButton({
  ics,
  filename,
  copy,
}: {
  /** lib/ics.ts 가 만든 파일 내용 */
  ics: string;
  filename: string;
  copy: ActionCopy;
}) {
  function download() {
    /**
     * 서버를 거치지 않고 기기 안에서 파일을 만든다.
     *
     * charset 을 빼면 한글 제목이 깨져 들어가는 캘린더가 있다.
     */
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();

    // 바로 거두면 아직 못 읽은 브라우저가 있다. 한 박자 뒤에 놓아준다
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  return (
    <ActionButton onClick={download} label={copy.calendar}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 9.5h17M8 3.5v3M16 3.5v3" />
    </ActionButton>
  );
}

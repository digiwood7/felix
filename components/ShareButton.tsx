"use client";

import { useState } from "react";

import ActionButton from "@/components/ActionButton";
import type { ActionCopy } from "@/lib/rules/types";

/**
 * 공유 — PRD §5 · §8 F3
 *
 * **이것이 실제 확산 경로다.** QR 을 찍는 손은 70대 환자의 손이 아니라
 * 40~50대 보호자의 손인 경우가 많고, 보호자가 만든 화면을 부모에게
 * 보내 준다. 받은 사람은 설치도 QR 재스캔도 필요 없다.
 *
 * 네이티브 공유 시트를 연다 — 그 안에 카카오톡이 이미 들어 있다.
 * 카카오 SDK 는 개발자 등록과 도메인 화이트리스트가 필요해 쓰지 않는다.
 *
 * 주소에는 답이 우물정 뒤에 담겨 있고(lib/encode.ts) 그대로 따라간다.
 */
type State = "idle" | "copied" | "manual";

export default function ShareButton({ copy }: { copy: ActionCopy }) {
  const [state, setState] = useState<State>("idle");
  const [url, setUrl] = useState("");

  async function share() {
    const here = window.location.href;

    // 공유 시트. 실패하거나 사용자가 취소하면 조용히 다음 수단으로 간다
    if (navigator.share) {
      try {
        await navigator.share({ title: copy.share_title, url: here });
        return;
      } catch {
        // 취소했을 수도 있다. 복사로 넘어가되 화면을 흔들지 않는다
      }
    }

    /**
     * 복사로 대신한다.
     *
     * clipboard 는 보안 연결(https)에서만 있다. 사설 IP 로 열어 본
     * 경우에는 없으므로, 그때는 주소를 화면에 내어 직접 집게 한다.
     */
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(here);
        setState("copied");
        return;
      } catch {
        // 권한이 막혔다
      }
    }

    setUrl(here);
    setState("manual");
  }

  return (
    /* 알림은 버튼 아래에 띄운다. 자리를 차지하면 세 버튼의 폭이 흔들린다 */
    <div className="relative flex flex-1">
      <ActionButton onClick={share} label={copy.share}>
        <path d="M12 15.5V4M12 4L8 8M12 4l4 4" />
        <path d="M5 13.5v5A1.5 1.5 0 006.5 20h11a1.5 1.5 0 001.5-1.5v-5" />
      </ActionButton>

      {/* 복사됐다는 사실은 소리로도 알려야 한다. 화면을 못 보는 사용자에게
          아무 일도 일어나지 않은 것과 구분되지 않는다 */}
      <p aria-live="polite" className="sr-only">
        {state === "copied" ? copy.copied : ""}
      </p>

      {state === "copied" && (
        <p className="absolute top-full right-0 z-10 mt-2 w-max max-w-[70vw] rounded-xl bg-slate-900 px-4 py-3 text-[1.06rem] font-bold text-white">
          {copy.copied}
        </p>
      )}

      {state === "manual" && (
        <div className="absolute top-full right-0 z-10 mt-2 w-max max-w-[80vw] rounded-xl border-2 border-slate-900 bg-white px-4 py-3">
          <p className="text-[1.06rem] leading-snug text-slate-700">
            {copy.copy_manual}
          </p>
          {/* 자유 텍스트 입력이 아니다. 읽기만 하는 자리라 문단으로 둔다 */}
          <p className="mt-2 text-[1rem] leading-snug break-all text-slate-900 select-all">
            {url}
          </p>
        </div>
      )}
    </div>
  );
}

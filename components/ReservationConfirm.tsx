"use client";

import { useEffect, useRef } from "react";

import Disclaimer from "@/components/Disclaimer";
import {
  formatLocation,
  formatReservationDate,
  formatReservationTime,
  formatReservationTimeKorean,
} from "@/lib/reservationLabel";
import type { ExamRuleset } from "@/lib/rules/types";
import type { Reservation } from "@/lib/schedule";

/**
 * 최종 확인 창 — S1 입력과 S2 타임라인 사이.
 *
 * 왜 필요한가
 *   이 서비스의 모든 출력은 예약 일시 하나에서 역산된다. 날짜를 하루 잘못
 *   고르면 금식 시각도 도착 시각도 전부 틀린 채로 그럴듯하게 나온다.
 *   타임라인 머리글에도 예약이 적혀 있지만, 그때는 이미 읽을 것이
 *   많아져서 머리글을 지나친다. 다음 화면으로 넘어가기 전에 한 번,
 *   화면에 이것만 놓고 묻는다.
 *
 *   시각을 두 가지로 함께 보여 준다. "14:00" 은 안내문 · 예약 문자와
 *   글자 그대로 대조하기 위한 것이고, "오후 2시" 는 오전과 오후를
 *   뒤집어 고른 경우를 잡기 위한 것이다.
 *
 * 판단하지 않는다
 *   맞는지 아닌지는 환자가 정한다. 지난 날짜라거나 진료 시간이 아니라거나
 *   하는 말을 여기서 하지 않는다 (PRD §11).
 */
export default function ReservationConfirm({
  reservation,
  ruleset,
  locationId,
  onConfirm,
  onCancel,
}: {
  reservation: Reservation;
  ruleset: ExamRuleset;
  locationId: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // 열릴 때 제목으로 초점을 옮긴다. 확인 버튼에 두지 않는 이유는
  // 키보드 · 스위치 사용자가 Enter 를 눌러 둔 상태로 창을 지나칠 수 있어서다.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  // 뒤 화면이 스크롤되면 창이 떠 있다는 것이 흐려진다
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  // Esc 로 닫고, Tab 초점이 창 밖으로 새지 않게 가둔다 (WCAG 2.1.2 · 2.4.3)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
        return;
      }
      if (e.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;

      const focusable = panel.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (e.shiftKey && (active === first || active === headingRef.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 p-0 sm:items-center sm:p-4"
      // 배경을 눌러서 닫지 않는다. 고령 사용자가 화면 아무 데나 눌렀을 때
      // 창이 사라지면 무엇이 일어났는지 알 수 없다. 닫는 길은 두 버튼뿐이다.
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="max-h-full w-full max-w-md overflow-y-auto rounded-t-3xl bg-white px-5 pt-6 pb-5 sm:rounded-3xl"
      >
        <h2
          id="confirm-title"
          ref={headingRef}
          tabIndex={-1}
          className="text-[1.5rem] leading-tight font-extrabold text-slate-900 outline-none"
        >
          예약하신 내용이 맞습니까?
        </h2>
        {/* 두 문장을 한 문장으로 줄였다. 제목이 이미 "맞습니까?" 라고 물었으므로
            여기서는 무엇을 보고 답하면 되는지만 말한다.
            "예약 안내문" 은 S1 과 같은 낱말이다 — 화면마다 이름이 바뀌면 다시 읽는다 */}
        <p className="mt-2 text-[1.12rem] leading-relaxed text-slate-700">
          예약 안내문이나 문자와 맞춰 보세요.
        </p>

        <dl className="mt-5 divide-y-2 divide-slate-200 border-y-2 border-slate-200">
          <Row label="예약 날짜" value={formatReservationDate(reservation)} />
          <Row
            label="예약 시간"
            value={formatReservationTime(reservation)}
            sub={formatReservationTimeKorean(reservation)}
          />
          <Row label="검사 장소" value={formatLocation(ruleset, locationId)} />
        </dl>

        {/* 맞다는 쪽이 크고 아래에 있다. 엄지가 닿는 자리다 */}
        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={onConfirm}
            className="min-h-[60px] w-full rounded-2xl bg-slate-900 text-[1.35rem] font-bold text-white"
          >
            네, 맞습니다
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[56px] w-full rounded-2xl border-2 border-slate-500 bg-white text-[1.18rem] font-bold text-slate-800"
          >
            아니요, 다시 선택하겠습니다
          </button>
        </div>

        {/* 이 창이 화면 전체를 덮으므로 §11 문구가 가려진다. 창 안에 다시 넣는다 */}
        <Disclaimer />
      </div>
    </div>
  );
}

/**
 * 한 줄 = [항목 · 값]. 문장으로 쓰지 않는다.
 * 값이 항목보다 크고 굵어야 3초 안에 대조가 된다.
 */
function Row({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3">
      <dt className="w-[5.5rem] shrink-0 text-[1.06rem] font-medium text-slate-600">
        {label}
      </dt>
      <dd className="min-w-0 flex-1">
        <span className="text-[1.35rem] leading-snug font-extrabold text-slate-900">
          {value}
        </span>
        {sub && (
          <span className="ml-2 text-[1.12rem] font-bold text-slate-600">
            {sub}
          </span>
        )}
      </dd>
    </div>
  );
}

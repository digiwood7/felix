"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { formatReservationParam } from "@/lib/reservationParam";
import type { ExamRuleset } from "@/lib/rules/types";

/**
 * S1 입력 화면 — PRD §8 F1 · §10
 *
 * 절대 넣지 않는 것: 이름 · 등록번호 · 연락처 · 생년월일.
 * 이 조합으로는 개인 식별이 불가능해야 하고, 그것이 이 프로젝트가
 * 심의 없이 배포될 수 있는 유일한 근거다 (PRD §14).
 *
 * 시각을 시 · 분 두 단계 버튼으로 받는 이유
 *   워크플로우 초안은 "정시/30분 단위 버튼 그리드" 였으나 실제 예약은
 *   08:25 처럼 5분 단위로 잡힌다. 30분 그리드로는 입력 자체가 불가능하다.
 *   드롭다운은 고령 사용자에게 조작이 어려워 쓰지 않는다 (PRD §5).
 *
 * 모든 선택은 라디오 버튼이다. 보기에는 버튼이지만 실제로는 <input type="radio">라
 * 스크린리더와 키보드가 그대로 동작한다. 직접 만든 버튼으로는 이게 안 된다.
 */
export default function ReservationForm({ ruleset }: { ruleset: ExamRuleset }) {
  const router = useRouter();

  const [date, setDate] = useState("");
  const [hour, setHour] = useState<number | null>(null);
  const [minute, setMinute] = useState<number | null>(null);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [today, setToday] = useState("");

  // 오늘 날짜는 마운트 후에 넣는다. 서버와 클라이언트의 날짜가 어긋나
  // 하이드레이션이 깨지는 것을 피한다
  useEffect(() => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    setToday(
      `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    );
  }, []);

  const ready = date !== "" && hour !== null && minute !== null && locationId;

  function submit() {
    if (!ready) return;
    const t = formatReservationParam({
      year: Number(date.slice(0, 4)),
      month: Number(date.slice(5, 7)),
      day: Number(date.slice(8, 10)),
      hour: hour!,
      minute: minute!,
    });
    router.push(`/pet?t=${t}&b=${locationId}`);
  }

  return (
    <div className="flex flex-col gap-7">
      <Section step={1} title="검사 날짜">
        <input
          type="date"
          value={date}
          min={today || undefined}
          onChange={(e) => setDate(e.target.value)}
          aria-label="검사 날짜"
          className="min-h-[56px] w-full rounded-xl border-2 border-slate-500 px-4 text-[1.24rem] font-bold text-slate-900"
        />
      </Section>

      {/* 안내지가 "예약시간" 을 쓴다. 화면 전체에서 "시간" 으로 통일한다 */}
      <Section step={2} title="예약 시간">
        <Choices
          name="hour"
          legend="시"
          columns="grid-cols-5"
          options={HOURS.map((h) => ({ value: h, label: `${h}시` }))}
          selected={hour}
          onSelect={setHour}
        />
        <div className="mt-3">
          {/* 버튼마다 "분"을 붙인다. 숫자만 두면 시 그리드와 구분되지 않는다 */}
          <Choices
            name="minute"
            legend="분"
            columns="grid-cols-4"
            options={MINUTES.map((m) => ({
              value: m,
              label: `${String(m).padStart(2, "0")}분`,
            }))}
            selected={minute}
            onSelect={setMinute}
          />
        </div>
      </Section>

      <Section step={3} title={ruleset.locations.ask}>
        <p className="mb-2 text-[1.06rem] text-slate-600">
          {ruleset.locations.hint}
        </p>
        <Choices
          name="location"
          legend="검사 장소"
          columns="grid-cols-2"
          options={ruleset.locations.options.map((o) => ({
            value: o.id,
            label: o.label,
          }))}
          selected={locationId}
          onSelect={setLocationId}
        />
      </Section>

      {/* PRD §11 필수 표기 — 입력 항목 바로 아래에 둔다 */}
      <p className="rounded-xl bg-slate-100 px-4 py-3 text-[1.06rem] leading-snug text-slate-700">
        이름·등록번호 등 개인정보는 입력받지 않으며, 어떤 정보도 서버에 저장되지
        않습니다.
      </p>

      <button
        type="button"
        onClick={submit}
        disabled={!ready}
        className="min-h-[60px] w-full rounded-2xl bg-slate-900 text-[1.35rem] font-bold text-white disabled:bg-slate-300 disabled:text-slate-500"
      >
        준비 일정 보기
      </button>

      {/* 화면의 단계 이름과 같은 낱말을 쓴다. "장소" 라고 하면 무엇을 덜 골랐는지 헷갈린다 */}
      {!ready && (
        <p aria-live="polite" className="-mt-4 text-[1.06rem] text-slate-700">
          날짜 · 시간 · 건물을 모두 선택해 주세요
        </p>
      )}
    </div>
  );
}

/** PET 검사가 실제로 잡히는 시간대 (8~17시) */
const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17];

/** 실제 예약은 08:25 처럼 5분 단위로 잡힌다 */
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

function Section({
  step,
  title,
  children,
}: {
  step: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    // 구획 구분 — 타임라인의 날짜 머리와 같은 형태로 맞춘다.
    // 여백만으로 나누면 세 단계가 한 덩어리로 읽힌다.
    <section>
      <h2 className="mb-3 flex items-center gap-2 border-b-2 border-slate-900 pb-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[1.06rem] font-bold text-white">
          {step}
        </span>
        <span className="text-[1.24rem] font-bold text-slate-900">{title}</span>
      </h2>
      {children}
    </section>
  );
}

/**
 * 보기에는 버튼이지만 내용은 라디오 그룹이다.
 * fieldset/legend + input[type=radio] 라서 스크린리더가 "몇 개 중 몇 번째"를
 * 읽어 주고 키보드 화살표로 이동할 수 있다 (WCAG 1.3.1, 2.1.1).
 */
function Choices<T extends string | number>({
  name,
  legend,
  columns,
  options,
  selected,
  onSelect,
}: {
  name: string;
  legend: string;
  columns: string;
  options: { value: T; label: string }[];
  selected: T | null;
  onSelect: (v: T) => void;
}) {
  return (
    <fieldset>
      <legend className="sr-only">{legend}</legend>
      <div className={`grid ${columns} gap-2`}>
        {options.map((o) => {
          const on = selected === o.value;
          return (
            <label
              key={String(o.value)}
              // 테두리는 slate-500 이상이어야 한다.
              // slate-300 은 흰 배경 대비 1.5:1 로 WCAG 1.4.11(비텍스트 3:1) 미달이다.
              // 고령 사용자에게는 버튼의 경계가 보이지 않는 것과 같다.
              className={`flex min-h-[52px] cursor-pointer items-center justify-center rounded-xl border-2 text-[1.12rem] font-bold ${
                on
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-500 bg-white text-slate-800"
              }`}
            >
              <input
                type="radio"
                name={name}
                value={String(o.value)}
                checked={on}
                onChange={() => onSelect(o.value)}
                className="sr-only"
              />
              {o.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

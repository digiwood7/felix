"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import ReservationConfirm from "@/components/ReservationConfirm";
import { formatReservationParam } from "@/lib/reservationParam";
import type { ExamRuleset } from "@/lib/rules/types";
import type { Reservation } from "@/lib/schedule";

/**
 * S1 입력 화면 — PRD §8 F1 · §10
 *
 * 절대 넣지 않는 것: 이름 · 등록번호 · 연락처 · 생년월일.
 * 이 조합으로는 개인 식별이 불가능해야 하고, 그것이 이 프로젝트가
 * 심의 없이 배포될 수 있는 유일한 근거다 (PRD §14).
 *
 * 시각을 콤보박스 두 칸으로 받는 이유
 *   워크플로우 초안은 "정시/30분 단위 버튼 그리드" 였으나 실제 예약은
 *   08:25 처럼 5분 단위로 잡힌다. 30분 그리드로는 입력 자체가 불가능하다.
 *   5분 단위를 버튼으로 펴면 시 10개 + 분 12개 = **22개가 화면을 덮고**,
 *   날짜와 건물이 스크롤 아래로 밀린다 (레드팀 #9). 그래서 두 칸으로 접었다.
 *
 *   **되돌린 판단이다.** 이 자리에는 원래 "드롭다운은 고령 사용자에게
 *   조작이 어려워 쓰지 않는다 (PRD §5)" 가 적혀 있었다. 어느 쪽이 나은지는
 *   W3 대기실 관찰에서 실제 소요 시간을 재고 정한다.
 *
 * 건물 선택은 그대로 라디오 버튼이다. 보기에는 버튼이지만 실제로는
 * <input type="radio">라 스크린리더와 키보드가 그대로 동작한다.
 */
export default function ReservationForm({ ruleset }: { ruleset: ExamRuleset }) {
  const router = useRouter();

  const [date, setDate] = useState("");
  const [hour, setHour] = useState<number | null>(null);
  const [minute, setMinute] = useState<number | null>(null);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [today, setToday] = useState("");
  const [restored, setRestored] = useState(false);

  // 확인 창에 띄울 값. 열려 있는 동안 폼이 바뀔 일은 없지만,
  // 무엇을 보고 "네" 를 눌렀는지와 실제로 넘어가는 값이 갈라지지 않도록
  // 창을 열 때의 값을 그대로 들고 있는다
  const [pending, setPending] = useState<Reservation | null>(null);
  const submitRef = useRef<HTMLButtonElement>(null);

  // 덜 채우고 눌렀을 때 데려갈 자리
  const dateRef = useRef<HTMLInputElement>(null);
  const hourRef = useRef<HTMLSelectElement>(null);
  const minuteRef = useRef<HTMLSelectElement>(null);
  const locationRef = useRef<HTMLInputElement>(null);

  // 오늘 날짜와 지난 입력은 마운트 후에 넣는다.
  // 서버와 클라이언트가 달라져 하이드레이션이 깨지는 것을 피한다
  useEffect(() => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    setToday(todayStr);

    const saved = loadSaved();
    if (!saved) return;

    if (saved.locationId) setLocationId(saved.locationId);
    if (typeof saved.hour === "number") setHour(saved.hour);
    if (typeof saved.minute === "number") setMinute(saved.minute);

    // 지난 검사의 날짜는 되살리지 않는다.
    // 몇 달 뒤 추적 검사로 다시 왔을 때 옛 날짜가 채워져 있으면,
    // 환자가 알아채지 못하고 그대로 눌러 지나간 날짜의 일정을 보게 된다.
    // 건물과 시간은 대개 그대로라 남긴다.
    if (saved.date && saved.date >= todayStr) setDate(saved.date);

    setRestored(true);
  }, []);

  function clearSaved() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // 사파리 비공개 모드 등에서 막힐 수 있다. 화면은 그대로 지운다
    }
    setDate("");
    setHour(null);
    setMinute(null);
    setLocationId(null);
    setRestored(false);
  }

  const selectedLocation = ruleset.locations.options.find(
    (o) => o.id === locationId,
  );

  /**
   * 건물까지 골라야 넘어간다.
   *
   * 접수처 연락처가 건물마다 다르므로(본관 · 암병원) 건물은 선택 사항이
   * 아니다. 뒤 화면들도 주소에 건물이 없으면 이리로 되돌린다.
   */
  /**
   * 아직 안 고른 것들. **순서는 화면 순서 그대로다** — 위에서부터
   * 채우게 데려가야 사용자가 자기 위치를 잃지 않는다.
   *
   * 시각은 시 · 분 두 칸이지만 사용자에게는 "예약 시간" 한 단계다.
   * 둘 중 먼저 빈 칸으로 데려간다.
   */
  const missing: { label: string; focus: () => HTMLElement | null }[] = [
    ...(date === ""
      ? [{ label: "예약 날짜", focus: () => dateRef.current }]
      : []),
    ...(hour === null || minute === null
      ? [
          {
            label: "예약 시간",
            focus: () => (hour === null ? hourRef.current : minuteRef.current),
          },
        ]
      : []),
    ...(!selectedLocation
      ? [{ label: "건물", focus: () => locationRef.current }]
      : []),
  ];

  const ready = missing.length === 0;

  /**
   * 바로 넘어가지 않고 확인 창을 먼저 띄운다.
   *
   * 이 화면의 입력 하나가 뒤의 모든 시각을 정한다. 날짜를 하루 잘못 골라도
   * 타임라인은 아무 일 없다는 듯이 그려지기 때문에, 넘어가기 전에 한 번 묻는다.
   *
   * **덜 채웠어도 버튼은 죽이지 않는다.** 눌렀는데 아무 일도 일어나지
   * 않으면 자기가 잘못 눌렀는지 화면이 멈췄는지 알 길이 없다 — 그게
   * "왜 안 되지" 로 헤매는 진짜 원인이다. 대신 **빠진 자리로 데려간다.**
   */
  function askConfirm() {
    if (!ready) {
      const target = missing[0].focus();
      // 구획째로 옮긴다. 건물 라디오처럼 화면에서 1px 인 요소로 맞추면
      // 무엇을 하라는 것인지 안 보이는 자리에 멈춘다
      (target?.closest("section") ?? target)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      // 스크롤은 위에서 시켰다. focus 가 한 번 더 튀면 화면이 두 번 움직인다
      target?.focus({ preventScroll: true });
      return;
    }
    setPending({
      year: Number(date.slice(0, 4)),
      month: Number(date.slice(5, 7)),
      day: Number(date.slice(8, 10)),
      hour: hour!,
      minute: minute!,
    });
  }

  function cancelConfirm() {
    setPending(null);
    // 창을 닫으면 초점을 열었던 버튼으로 되돌린다 (WCAG 2.4.3)
    submitRef.current?.focus();
  }

  function go() {
    if (!pending) return;
    const t = formatReservationParam(pending);

    // 실제로 쓴 값만 남긴다. 서버가 아니라 이 기기에만 저장된다
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ date, hour, minute, locationId }),
      );
    } catch {
      // 저장에 실패해도 흐름을 막지 않는다
    }

    router.push(`/pet?t=${t}&b=${locationId}`);
  }

  return (
    <div className="flex flex-col gap-7">
      {/* 값이 미리 채워진 이유를 밝힌다. 모르고 그대로 누르면 안 된다 */}
      {restored && (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-slate-100 px-4 py-3 text-[1.06rem] text-slate-700">
          지난번에 선택하신 내용을 불러왔습니다
          <button
            type="button"
            onClick={clearSaved}
            // 44px 은 iOS 권장치다. PRD §13 은 48px 을 쓴다 — 고령 사용자
            // 기준이므로 더 큰 쪽을 따른다
            className="min-h-[48px] font-bold text-slate-900 underline underline-offset-4"
          >
            지우고 새로 선택
          </button>
        </p>
      )}
      {/* 안내지의 "예약일시" 와 같은 낱말을 쓴다.
          "검사 시간" 은 안내지에서 소요 시간이라는 뜻으로 쓰이므로 피한다 */}
      <Section step={1} title="예약 날짜" done={date !== ""}>
        <DateField
          value={date}
          min={today}
          onChange={setDate}
          inputRef={dateRef}
        />
      </Section>

      <Section
        step={2}
        title="예약 시간"
        done={hour !== null && minute !== null}
      >
        {/* 시 · 분을 한 줄에 둔다. 두 칸이 나란히 있어야 "08시 25분" 이
            하나의 시각이라는 것이 형태로 읽힌다 */}
        <div className="flex gap-2">
          <TimeSelect
            label="시"
            value={hour}
            onChange={setHour}
            selectRef={hourRef}
            options={HOURS.map((h) => ({
              value: h,
              label: `${String(h).padStart(2, "0")}시`,
            }))}
          />
          <TimeSelect
            label="분"
            value={minute}
            onChange={setMinute}
            selectRef={minuteRef}
            options={MINUTES.map((m) => ({
              value: m,
              label: `${String(m).padStart(2, "0")}분`,
            }))}
          />
        </div>
      </Section>

      <Section step={3} title={ruleset.locations.ask} done={!!selectedLocation}>
        <p className="mb-2 text-[1.06rem] text-slate-600">
          {ruleset.locations.hint}
        </p>
        <Choices
          name="location"
          legend="검사 장소"
          columns="grid-cols-2"
          firstInputRef={locationRef}
          options={ruleset.locations.options.map((o) => ({
            value: o.id,
            label: o.label,
          }))}
          selected={locationId}
          onSelect={setLocationId}
        />
      </Section>

      {/* PRD §11 필수 표기 — 문구를 고치지 않는다. 뒤에 사실만 덧붙인다 */}
      <p className="rounded-xl bg-slate-100 px-4 py-3 text-[1.06rem] leading-snug text-slate-700">
        이름·등록번호 등 개인정보는 입력받지 않으며, 어떤 정보도 서버에 저장되지
        않습니다. 선택하신 날짜와 시간은 이 기기에만 남습니다.
      </p>

      {/**
       * 덜 채웠어도 `disabled` 를 걸지 않는다. 누를 수 있어야 눌린 것을
       * 알고, 눌린 것을 알아야 다음에 무엇을 할지 화면이 말해 줄 수 있다.
       *
       * 대신 **모양으로 상태를 알린다** — 덜 채우면 테두리 버튼, 다 채우면
       * 채워진 버튼. 색만으로 나누지 않는다 (WCAG 1.4.1): 배경 · 테두리 ·
       * 글자색이 함께 바뀌고, 아래 문구가 무엇이 남았는지 말로 적는다.
       */}
      <button
        ref={submitRef}
        type="button"
        onClick={askConfirm}
        className={`min-h-[60px] w-full rounded-2xl text-[1.35rem] font-bold ${
          ready
            ? "bg-slate-900 text-white"
            : "border-2 border-slate-500 bg-white text-slate-800"
        }`}
      >
        준비 일정 보기
      </button>

      {/* 화면의 단계 이름과 같은 낱말을 쓴다. "장소" 라고 하면 무엇을 덜 골랐는지 헷갈린다.
          **빠진 것만 이름을 댄다** — "모두 선택해 주세요" 는 셋 중 무엇이
          남았는지 알려주지 않아서, 다 골랐다고 믿는 사람을 그대로 세워 둔다 */}
      {!ready && (
        <p aria-live="polite" className="-mt-4 text-[1.06rem] text-slate-700">
          {missingSentence(missing.map((m) => m.label))}
        </p>
      )}

      {/* 건물은 확인 창이 뜰 때 이미 골라져 있다 (ready 조건) */}
      {pending && selectedLocation && (
        <ReservationConfirm
          reservation={pending}
          location={selectedLocation}
          onConfirm={go}
          onCancel={cancelConfirm}
        />
      )}
    </div>
  );
}

/**
 * 마지막 선택을 이 기기에만 남긴다.
 *
 * 안내지를 잃어버리면 날짜·시간을 알 길이 없어 화면을 아예 못 쓴다.
 * 한 번 넣어 두면 다음부터는 다시 찾지 않아도 된다.
 *
 * 서버가 아니라 브라우저 저장소이므로 "어떤 정보도 서버에 저장되지 않습니다"
 * (PRD §11) 는 그대로 참이다. 개인 식별 정보도 들어가지 않는다.
 */
const STORAGE_KEY = "pet-time:last-reservation";

interface SavedReservation {
  date?: string;
  hour?: number;
  minute?: number;
  locationId?: string;
}

function loadSaved(): SavedReservation | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedReservation) : null;
  } catch {
    // 비공개 모드이거나 값이 깨졌다. 저장이 없는 것으로 본다
    return null;
  }
}

/** PET 검사가 실제로 잡히는 시간대 (8~17시) */
const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17];

/** 실제 예약은 08:25 처럼 5분 단위로 잡힌다 */
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

/**
 * 시각 한 칸 — 콤보박스.
 *
 * 브라우저 기본 <select> 라 목록은 OS 가 그린다. 안드로이드는 큰 목록,
 * iOS 는 하단 드럼이라 **화면 안에서 22개 버튼을 훑는 것보다 한 번에
 * 끝난다.** 대신 무엇을 고르는 칸인지가 닫혀 있을 때 안 보이므로,
 * 고르기 전에는 "시" · "분" 을 자리표시자로 띄워 둔다.
 *
 * **보이는 글자는 우리가 그리고, 진짜 select 는 투명하게 겹친다.**
 * 아래 DateField 와 같은 수법이고 이유도 같다 — Safari 는 select 에
 * `text-align` 을 무시한다. 값을 화살표 옆에 붙이려면 select 안의 글자에
 * 기대서는 안 된다. 크롬에서는 먹고 사파리에서는 안 먹어서, 고쳤는데
 * 안 고쳐진 것처럼 보인다.
 *
 * 눌리는 것은 select 라 목록은 그대로 뜬다. 화살표도 우리가 그린다 —
 * 기본 화살표를 두면 기종마다 달라 두 칸의 폭이 어긋난다.
 *
 * 고르기 전에는 화살표 왼쪽, 고른 뒤에는 가운데다. 안내와 값은 하는 일이
 * 달라서 서는 자리도 다르다.
 */
function TimeSelect({
  label,
  value,
  onChange,
  options,
  selectRef,
}: {
  label: string;
  value: number | null;
  onChange: (v: number) => void;
  options: { value: number; label: string }[];
  selectRef?: React.Ref<HTMLSelectElement>;
}) {
  const shown = options.find((o) => o.value === value);

  return (
    // 테두리는 slate-500 이상 — slate-300 은 흰 배경 대비 1.5:1 로
    // WCAG 1.4.11(비텍스트 3:1) 미달이다
    <div className="relative flex-1 rounded-xl border-2 border-slate-500 bg-white focus-within:ring-4 focus-within:ring-slate-300">
      {/* 자리표시자는 화살표 왼쪽에 붙이고, 고른 값은 칸 한가운데로 옮긴다.
          자리표시자는 "여기를 눌러 고르라" 는 안내라 화살표 옆에 있는 것이
          맞고, 고른 값은 읽는 대상이라 두 칸의 중심이 맞아야
          "09시 10분" 이 한 시각으로 읽힌다.
          가운데일 때 양쪽 여백(px-10)을 같게 두어야 진짜 가운데가 된다 */}
      <div
        aria-hidden="true"
        className={`pointer-events-none flex min-h-[56px] items-center ${
          shown ? "justify-center px-10" : "justify-end pr-10 pl-3"
        }`}
      >
        <span
          className={`text-[1.24rem] font-bold ${shown ? "text-slate-900" : "text-slate-500"}`}
        >
          {shown ? shown.label : label}
        </span>
      </div>

      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="pointer-events-none absolute top-1/2 right-3 h-6 w-6 -translate-y-1/2 text-slate-600"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6 9l6 6 6-6" />
      </svg>

      <select
        ref={selectRef}
        value={value === null ? "" : String(value)}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={`예약 시간 ${label}`}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      >
        {/* 아직 안 고른 상태. 고르고 나면 목록에서 사라져 되돌아갈 수 없게 두지 않는다 */}
        <option value="" disabled>
          {label}
        </option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * 날짜 입력.
 *
 * 브라우저가 그려 주는 글자에 기대지 않고 직접 그린다.
 * iOS Safari 는 appearance:none 을 주면 칸 안의 글자를 아예 지워 버리고,
 * 그 속성을 빼면 이번에는 내용 최소 너비 때문에 가로로 넘친다.
 * 둘 중 하나를 고르는 대신, 보이는 부분은 우리가 그리고
 * 실제 input 은 투명하게 겹쳐 둔다. 눌리는 것은 input 이라 달력은 그대로 뜬다.
 *
 * 박스는 글자만큼만 차지한다(w-fit). 화면 끝까지 늘리면 배경처럼 보여
 * 눌러야 할 곳이라는 것이 흐려진다.
 */
function DateField({
  value,
  min,
  onChange,
  inputRef,
}: {
  value: string;
  min: string;
  onChange: (v: string) => void;
  inputRef?: React.Ref<HTMLInputElement>;
}) {
  return (
    <div className="relative w-fit rounded-xl border-2 border-slate-500 focus-within:ring-4 focus-within:ring-slate-300">
      <div
        aria-hidden="true"
        className="pointer-events-none flex min-h-[56px] items-center gap-3 px-4"
      >
        <span
          className={`text-[1.24rem] font-bold ${value ? "text-slate-900" : "text-slate-500"}`}
        >
          {value ? formatKoreanDate(value) : "연도. 월. 일."}
        </span>
        <svg
          viewBox="0 0 24 24"
          className="h-6 w-6 shrink-0 text-slate-600"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 10h18M8 3v4M16 3v4" />
        </svg>
      </div>

      <input
        ref={inputRef}
        type="date"
        value={value}
        min={min || undefined}
        onChange={(e) => onChange(e.target.value)}
        aria-label="예약 날짜"
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </div>
  );
}

/** "2026-08-06" → "2026년 8월 6일" */
function formatKoreanDate(value: string): string {
  return `${Number(value.slice(0, 4))}년 ${Number(value.slice(5, 7))}월 ${Number(value.slice(8, 10))}일`;
}

/**
 * "예약 시간을 아직 안 고르셨습니다"
 *
 * 빠진 것을 이름으로 댄다. 조사(을/를)는 마지막 낱말의 받침이 정한다 —
 * "건물을" · "예약 날짜를". "을(를)" 처럼 괄호로 도망가지 않는다.
 * 읽어 주는 화면이라 소리로도 나가고, 그때 괄호가 그대로 읽힌다.
 */
function missingSentence(labels: string[]): string {
  const joined = labels.join(" · ");
  const last = joined.charCodeAt(joined.length - 1);
  // 한글 음절은 (코드 - 0xAC00) % 28 이 0 이면 받침이 없다
  const hasFinal =
    last >= 0xac00 && last <= 0xd7a3 && (last - 0xac00) % 28 !== 0;
  return `${joined}${hasFinal ? "을" : "를"} 아직 안 고르셨습니다`;
}

function Section({
  step,
  title,
  done,
  children,
}: {
  step: number;
  title: string;
  /** 이 단계를 채웠는가. 버튼까지 내려가지 않아도 눈에 띈다 */
  done: boolean;
  children: React.ReactNode;
}) {
  return (
    // 구획 구분 — 타임라인의 날짜 머리와 같은 형태로 맞춘다.
    // 여백만으로 나누면 세 단계가 한 덩어리로 읽힌다.
    //
    // min-w-0 이 없으면 flex 자식의 기본값(min-width:auto) 때문에
    // 안쪽 요소가 넘칠 때 구획째로 밀려 가로 스크롤이 생긴다.
    <section className="min-w-0">
      <h2 className="mb-3 flex items-center gap-2 border-b-2 border-slate-900 pb-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[1.06rem] font-bold text-white">
          {step}
        </span>
        <span className="min-w-0 text-[1.24rem] font-bold text-slate-900">
          {title}
        </span>
        {/* 채운 단계에만 붙는다. 체크 기호가 아니라 **글자**로 적는다 —
            기호는 읽는 사람마다 다르게 해석되고 스크린리더가 읽지 못한다
            (WCAG 1.1.1, PRD §13) */}
        {done && (
          <span className="ml-auto shrink-0 rounded-full bg-slate-100 px-3 py-1 text-[0.95rem] font-bold text-slate-700">
            선택함
          </span>
        )}
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
  firstInputRef,
}: {
  name: string;
  legend: string;
  columns: string;
  options: { value: T; label: string }[];
  selected: T | null;
  onSelect: (v: T) => void;
  /** 덜 고르고 넘어가려 할 때 데려갈 자리 */
  firstInputRef?: React.Ref<HTMLInputElement>;
}) {
  return (
    <fieldset>
      <legend className="sr-only">{legend}</legend>
      <div className={`grid ${columns} gap-2`}>
        {options.map((o, i) => {
          const on = selected === o.value;
          return (
            <label
              key={String(o.value)}
              // 테두리는 slate-500 이상이어야 한다.
              // slate-300 은 흰 배경 대비 1.5:1 로 WCAG 1.4.11(비텍스트 3:1) 미달이다.
              // 고령 사용자에게는 버튼의 경계가 보이지 않는 것과 같다.
              // 라디오가 sr-only 라 초점이 어디 있는지 보이지 않는다.
              // 덜 고르고 넘어가려 할 때 이 자리로 데려오므로, 초점을
              // 받은 칸이 눈에 보여야 한다 (WCAG 2.4.7)
              className={`flex min-h-[52px] cursor-pointer items-center justify-center rounded-xl border-2 text-[1.12rem] font-bold has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-slate-300 ${
                on
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-500 bg-white text-slate-800"
              }`}
            >
              <input
                ref={i === 0 ? firstInputRef : undefined}
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

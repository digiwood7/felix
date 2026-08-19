"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { clearBody, loadBody, saveAnswers } from "@/lib/answers";
import { encodeAnswers } from "@/lib/encode";
import type { Answers, DayRef, Question, TimeAnswer } from "@/lib/questions";
import {
  MENSTRUATION_ID,
  NONE_ID,
  emptyAnswers,
  isAnswered,
  isValidNumber,
} from "@/lib/questions";
import type { ExamRuleset, NumberField, TimeCopy } from "@/lib/rules/types";

/**
 * S3 문답 — PRD §8 F2 · §10
 *
 * 1문 1화면. 한 화면에 하나만 물어야 고령 사용자가 놓치지 않는다.
 * 문항 정의는 lib/questions.ts 에, 문구는 룰셋에 있다.
 *
 * 화면 언어는 S1 입력 화면과 같다 — 같은 크기의 버튼, 같은 테두리,
 * 고른 것은 검게 채운다. 두 화면이 다른 서비스처럼 보이면 환자는
 * 중간에 멈춘다.
 *
 * 자유 텍스트 입력이 하나도 없다. 응답은 서버로 보내지 않는다.
 */
export default function QuestionFlow({
  ruleset,
  questions,
  backHref,
  restoredCopy,
}: {
  /** 답을 주소에 실을 때 항목 자리번호를 여기서 읽는다 (lib/encode.ts) */
  ruleset: ExamRuleset;
  questions: Question[];
  backHref: string;
  /** 지난번 키 · 몸무게를 불러왔을 때 보여줄 문구 */
  restoredCopy: { restored: string; restored_action: string };
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>(emptyAnswers());
  const [restored, setRestored] = useState(false);

  /**
   * 키 · 몸무게는 지난 검사와 달라지지 않는다. 다시 묻지 않는다.
   *
   * 금식 · 복약 · 생리는 불러오지 않는다 — 당일 사실이라 어제 답을
   * 되살리면 접수에서 틀린 카드를 내밀게 된다.
   */
  useEffect(() => {
    const body = loadBody();
    if (!body) return;
    setAnswers((prev) => ({
      ...prev,
      body: { height: body.height, weight: body.weight, unknown: false },
    }));
    setRestored(true);
  }, []);

  const question = questions[step];
  const isLast = step === questions.length - 1;

  function goBack() {
    if (step === 0) router.push(backHref);
    else setStep(step - 1);
  }

  /**
   * 방금 고른 답을 인자로 받는다.
   *
   * 한 번 누르면 바로 넘어가는 버튼은, 눌린 순간의 상태를 그대로 넘겨야 한다.
   * setState 는 다음 렌더에 반영되므로 여기서 answers 를 읽으면
   * 한 박자 전 값을 보고 "아직 안 골랐다" 며 멈춘다.
   */
  function goNext(current: Answers = answers) {
    if (!isAnswered(question, current)) return;
    if (isLast) {
      /**
       * 답을 주소에 실어 카드로 넘어간다.
       *
       * 서버에 저장하지 않고도 카드를 다시 열고 남에게 보낼 수 있게 하는
       * 방법은 이것뿐이다 (PRD §8 F3). 보호자가 만들어 환자에게 보내는 것이
       * 실제 확산 경로이므로, 카드 주소 하나로 화면이 재현되어야 한다.
       *
       * set 이다 — 이미 붙어 있는 a 가 있으면 갈아 끼운다. 붙이기만 하면
       * 문답을 다시 하고 온 사람의 주소에 옛 답이 함께 남는다.
       */
      const params = new URLSearchParams(window.location.search);
      params.set("a", encodeAnswers(ruleset, saveAnswers(current)));
      router.push(`/pet/card?${params.toString()}`);
    } else {
      setStep(step + 1);
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <Progress current={step + 1} total={questions.length} />

      <div className="flex-1">
        <h1 className="text-[1.41rem] leading-snug font-extrabold text-slate-900">
          {question.title}
        </h1>
        {question.hint && (
          <p className="mt-2 text-[1.06rem] leading-snug text-slate-600">
            {question.hint}
          </p>
        )}

        {/* 값이 미리 채워진 이유를 밝힌다. 모르고 그대로 넘기면
            옛 몸무게로 체중 상한이 판정된다 (S1 과 같은 방식) */}
        {question.id === "body" && restored && (
          <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-slate-100 px-4 py-3 text-[1.06rem] text-slate-700">
            {restoredCopy.restored}
            <button
              type="button"
              onClick={() => {
                clearBody();
                setAnswers({
                  ...answers,
                  body: { height: null, weight: null, unknown: false },
                });
                setRestored(false);
              }}
              className="min-h-[44px] font-bold text-slate-900 underline underline-offset-4"
            >
              {restoredCopy.restored_action}
            </button>
          </p>
        )}

        <div className="mt-5">
          <Body
            key={question.id}
            question={question}
            answers={answers}
            onChange={setAnswers}
            onAdvance={goNext}
          />
        </div>
      </div>

      <div className="mt-8 flex gap-3">
        <button
          type="button"
          onClick={goBack}
          className="min-h-[60px] rounded-2xl border-2 border-slate-500 px-6 text-[1.18rem] font-bold text-slate-700"
        >
          이전
        </button>
        <button
          type="button"
          onClick={() => goNext()}
          disabled={!isAnswered(question, answers)}
          className="min-h-[60px] flex-1 rounded-2xl bg-slate-900 text-[1.24rem] font-bold text-white disabled:bg-slate-300 disabled:text-slate-500"
        >
          {isLast ? "요약카드 보기" : "다음"}
        </button>
      </div>
    </div>
  );
}

function Progress({ current, total }: { current: number; total: number }) {
  return (
    <div className="mb-5">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-[1.06rem] font-bold text-slate-700">
          {current} / {total}
        </span>
        {/* 키 · 몸무게는 이제 기기에 남는다. "저장되지 않습니다" 는 더 이상
            참이 아니므로 S1 과 같은 낱말("서버")로 정확히 적는다 (PRD §11) */}
        <span className="text-[1.06rem] text-slate-600">
          서버에 저장되지 않습니다
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={current}
        aria-valuemin={1}
        aria-valuemax={total}
        aria-label="문답 진행률"
        className="h-2 w-full overflow-hidden rounded-full bg-slate-200"
      >
        <div
          className="h-full rounded-full bg-slate-900 transition-[width]"
          style={{ width: `${(current / total) * 100}%` }}
        />
      </div>
    </div>
  );
}

function Body({
  question,
  answers,
  onChange,
  onAdvance,
}: {
  question: Question;
  answers: Answers;
  onChange: (a: Answers) => void;
  /** 방금 고른 답을 함께 넘긴다. 상태 반영을 기다리지 않기 위해서다 */
  onAdvance: (a: Answers) => void;
}) {
  /** 고르자마자 넘어가는 버튼 — 한 번 누르는 것으로 끝나는 답에만 쓴다 */
  function answerAndAdvance(next: Answers) {
    onChange(next);
    onAdvance(next);
  }

  switch (question.id) {
    /**
     * "네" 가 금식을 지켰다는 뜻이다. 지켰으면 더 물을 것이 없으므로
     * 바로 넘어가고, 못 지켰을 때만 마지막으로 드신 때를 묻는다.
     */
    case "fasting": {
      const broken = answers.fasting?.kept === false;
      return (
        <>
          <TwoChoice
            yesLabel={question.yesLabel}
            noLabel={question.noLabel}
            isYes={answers.fasting?.kept === true}
            isNo={broken}
            onYes={() =>
              answerAndAdvance({
                ...answers,
                fasting: { kept: true, time: null },
              })
            }
            onNo={() =>
              onChange({
                ...answers,
                fasting: { kept: false, time: answers.fasting?.time ?? null },
              })
            }
          />
          {broken && (
            <>
              <SubTitle>{question.timeTitle}</SubTitle>
              <TimePicker
                copy={question.time!}
                value={answers.fasting?.time ?? null}
                onChange={(t) =>
                  onChange({ ...answers, fasting: { kept: false, time: t } })
                }
              />
            </>
          )}
        </>
      );
    }

    case "diabetes": {
      const uses = answers.diabetes?.uses === true;
      return (
        <>
          <TwoChoice
            yesLabel={question.yesLabel}
            noLabel={question.noLabel}
            isYes={uses}
            isNo={answers.diabetes?.uses === false}
            onYes={() =>
              onChange({
                ...answers,
                diabetes: { uses: true, time: answers.diabetes?.time ?? null },
              })
            }
            onNo={() =>
              answerAndAdvance({
                ...answers,
                diabetes: { uses: false, time: null },
              })
            }
          />
          {uses && (
            <>
              <SubTitle>{question.timeTitle}</SubTitle>
              <TimePicker
                copy={question.time!}
                value={answers.diabetes?.time ?? null}
                onChange={(t) =>
                  onChange({ ...answers, diabetes: { uses: true, time: t } })
                }
              />
            </>
          )}
        </>
      );
    }

    /**
     * 모르면 모른다고 답할 수 있다. 억지로 채우게 하면 어림값이 들어오고,
     * 그 값으로 체중 상한 판정이 돌아간다.
     */
    case "body": {
      const [height, weight] = question.fields!;
      const unknown = answers.body.unknown;
      return (
        <div className="flex flex-col gap-5">
          <NumberInput
            field={height}
            value={answers.body.height}
            disabled={unknown}
            onChange={(v) =>
              onChange({ ...answers, body: { ...answers.body, height: v } })
            }
          />
          <NumberInput
            field={weight}
            value={answers.body.weight}
            disabled={unknown}
            onChange={(v) =>
              onChange({ ...answers, body: { ...answers.body, weight: v } })
            }
          />
          {/* 두 입력칸과 같은 간격으로 두면 세 번째 입력칸처럼 읽힌다.
              이건 "채우기" 가 아니라 "안 채우기" 라서 떼어 놓는다 */}
          <div className="mt-3">
            <Toggle
              label={question.unknownLabel!}
              checked={unknown}
              onToggle={() =>
                onChange({
                  ...answers,
                  body: unknown
                    ? { ...answers.body, unknown: false }
                    : { height: null, weight: null, unknown: true },
                })
              }
            />
          </div>
        </div>
      );
    }

    /**
     * 나이도 성별도 저장하지 않는다. 이 문항이 해당되는지와,
     * 해당될 때 고른 항목만 남는다.
     */
    case "female": {
      const applies = answers.female?.applies === true;
      const checks = answers.female?.checks ?? [];
      const day = answers.female?.menstrualDay ?? null;

      function setChecks(next: string[]) {
        onChange({
          ...answers,
          female: {
            applies: true,
            checks: next,
            // 생리를 빼면 일수도 함께 지운다. 남겨 두면 고르지 않은 값이 카드에 찍힌다
            menstrualDay: next.includes(MENSTRUATION_ID) ? day : null,
          },
        });
      }

      return (
        <>
          <TwoChoice
            yesLabel={question.yesLabel}
            noLabel={question.noLabel}
            isYes={applies}
            isNo={answers.female?.applies === false}
            onYes={() =>
              onChange({
                ...answers,
                female: { applies: true, checks, menstrualDay: day },
              })
            }
            onNo={() =>
              answerAndAdvance({
                ...answers,
                female: { applies: false, checks: [], menstrualDay: null },
              })
            }
          />
          {applies && (
            <>
              <SubTitle>{question.detailTitle}</SubTitle>
              <MultiSelect
                stacked
                options={question.options!}
                selected={checks}
                onToggle={(id) => setChecks(toggle(checks, id))}
              />
              {/* 셋 다 아니라는 답도 답이다. 빈 채로 넘기는 것과 구분한다 */}
              <div className="mt-2">
                <Toggle
                  label={question.noneLabel!}
                  checked={checks.includes(NONE_ID)}
                  onToggle={() =>
                    setChecks(checks.includes(NONE_ID) ? [] : [NONE_ID])
                  }
                />
              </div>
              {checks.includes(MENSTRUATION_ID) && (
                <>
                  <SubTitle>{question.dayTitle}</SubTitle>
                  <Grid
                    columns="grid-cols-4"
                    options={Array.from(
                      { length: question.dayMax! },
                      (_, i) => ({
                        value: i + 1,
                        label: `${i + 1}${question.dayUnit}`,
                      }),
                    )}
                    selected={day}
                    onSelect={(v) =>
                      onChange({
                        ...answers,
                        female: {
                          applies: true,
                          checks,
                          menstrualDay: v,
                        },
                      })
                    }
                  />
                </>
              )}
            </>
          )}
        </>
      );
    }
  }
}

function SubTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-6 mb-3 text-[1.18rem] font-bold text-slate-900">
      {children}
    </p>
  );
}

function toggle(list: string[], id: string): string[] {
  // "셋 다 해당사항 없음" 과 개별 항목은 같이 설 수 없다
  const cleaned = list.filter((x) => x !== NONE_ID);
  return cleaned.includes(id)
    ? cleaned.filter((x) => x !== id)
    : [...cleaned, id];
}

/** 왼쪽이 언제나 긍정("네" · "예") 이다. 화면마다 자리가 바뀌면 잘못 누른다 */
function TwoChoice({
  yesLabel,
  noLabel,
  isYes,
  isNo,
  onYes,
  onNo,
}: {
  yesLabel: string;
  noLabel: string;
  isYes: boolean;
  isNo: boolean;
  onYes: () => void;
  onNo: () => void;
}) {
  const base =
    "min-h-[68px] flex-1 rounded-2xl border-2 text-[1.24rem] font-bold";
  const on = "border-slate-900 bg-slate-900 text-white";
  const off = "border-slate-500 bg-white text-slate-800";

  return (
    <div className="flex gap-3">
      <button
        type="button"
        onClick={onYes}
        aria-pressed={isYes}
        className={`${base} ${isYes ? on : off}`}
      >
        {yesLabel}
      </button>
      <button
        type="button"
        onClick={onNo}
        aria-pressed={isNo}
        className={`${base} ${isNo ? on : off}`}
      >
        {noLabel}
      </button>
    </div>
  );
}

/** 체크 하나짜리. 목록 안의 항목과 같은 모양이라 따로 배우지 않아도 된다 */
function Toggle({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <label
      className={`flex min-h-[60px] cursor-pointer items-center gap-3 rounded-xl border-2 px-4 text-[1.12rem] leading-snug font-bold ${
        checked
          ? "border-slate-900 bg-slate-900 text-white"
          : "border-slate-500 bg-white text-slate-800"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="sr-only"
      />
      <CheckBox on={checked} />
      {label}
    </label>
  );
}

function CheckBox({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 ${
        on ? "border-white bg-white text-slate-900" : "border-slate-500"
      }`}
    >
      {on ? "✓" : ""}
    </span>
  );
}

function MultiSelect({
  options,
  selected,
  onToggle,
  stacked = false,
}: {
  options: { id: string; label: string }[];
  selected: string[];
  onToggle: (id: string) => void;
  stacked?: boolean;
}) {
  return (
    <div className={`grid gap-2 ${stacked ? "grid-cols-1" : "grid-cols-2"}`}>
      {options.map((o) => {
        const on = selected.includes(o.id);
        return (
          <label
            key={o.id}
            className={`flex min-h-[60px] cursor-pointer items-center gap-3 rounded-xl border-2 px-4 text-[1.12rem] leading-snug font-bold ${
              on
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-500 bg-white text-slate-800"
            }`}
          >
            <input
              type="checkbox"
              checked={on}
              onChange={() => onToggle(o.id)}
              className="sr-only"
            />
            <CheckBox on={on} />
            {o.label}
          </label>
        );
      })}
    </div>
  );
}

/**
 * 숫자를 직접 받는다.
 *
 * 자유 텍스트가 아니다 — 숫자판만 뜨고, 이름도 증상도 적을 수 없다.
 * 그래서 URL · 공유 · 로그 어디에도 원문이 생기지 않는다 (PRD §14).
 *
 * 범위를 벗어난 값은 화면에서 바로 알린다. 접수에서 다시 물어야 하는
 * 값을 그대로 통과시키면 이 화면이 있으나 마나가 된다.
 */
function NumberInput({
  field,
  value,
  disabled,
  onChange,
}: {
  field: NumberField;
  value: number | null;
  disabled: boolean;
  onChange: (v: number | null) => void;
}) {
  const invalid = value !== null && !isValidNumber(field, value);

  return (
    <div>
      <label className="mb-2 block text-[1.18rem] font-bold text-slate-900">
        {field.label}
      </label>
      <div
        className={`flex items-center gap-2 rounded-2xl border-2 px-4 ${
          disabled
            ? "border-slate-300 bg-slate-100"
            : invalid
              ? "border-slate-900 bg-white"
              : "border-slate-500 bg-white"
        } focus-within:ring-4 focus-within:ring-slate-300`}
      >
        <input
          type="number"
          inputMode="numeric"
          min={field.min}
          max={field.max}
          disabled={disabled}
          value={value ?? ""}
          onChange={(e) =>
            onChange(e.target.value === "" ? null : Number(e.target.value))
          }
          aria-label={`${field.label} (${field.unit})`}
          className="min-h-[60px] w-full bg-transparent text-[1.5rem] font-extrabold text-slate-900 outline-none disabled:text-slate-400"
          placeholder="—"
        />
        <span className="text-[1.24rem] font-bold text-slate-600">
          {field.unit}
        </span>
      </div>
      {invalid && (
        <p aria-live="polite" className="mt-1 text-[1.06rem] text-slate-700">
          {field.min} ~ {field.max}
          {field.unit} 사이로 입력해 주세요
        </p>
      )}
    </div>
  );
}

/**
 * 예약일 기준 어제/오늘 + 시 + 분. 절대 날짜를 묻지 않는다 — 환자가 헷갈린다.
 *
 * 시 · 분은 드롭다운이다. 24개 · 6개 버튼을 늘어놓으면 화면 한 판을
 * 통째로 먹는데, 이 시각은 금식을 못 지킨 사람만 고르는 값이다.
 *
 * 셋을 모두 고르기 전에는 답으로 넘기지 않는다. 기본값을 채워 두면
 * 환자가 고르지 않은 시각이 요약카드에 찍힌다.
 */
function TimePicker({
  copy,
  value,
  onChange,
}: {
  copy: TimeCopy;
  value: TimeAnswer | null;
  onChange: (t: TimeAnswer) => void;
}) {
  const [day, setDay] = useState<DayRef | null>(value?.day ?? null);
  const [hour, setHour] = useState<number | null>(value?.hour ?? null);
  const [minute, setMinute] = useState<number | null>(value?.minute ?? null);

  function emit(d: DayRef | null, h: number | null, m: number | null) {
    if (d !== null && h !== null && m !== null)
      onChange({ day: d, hour: h, minute: m });
  }

  const minutes = Array.from(
    { length: Math.ceil(60 / copy.minute_step) },
    (_, i) => i * copy.minute_step,
  );

  return (
    <div className="flex flex-col gap-4">
      <fieldset>
        <legend className="mb-2 text-[1.06rem] font-bold text-slate-700">
          {copy.day_label}
        </legend>
        <Grid
          columns="grid-cols-2"
          options={[
            { value: "yesterday", label: copy.yesterday },
            { value: "today", label: copy.today },
          ]}
          selected={day}
          onSelect={(v) => {
            setDay(v as DayRef);
            emit(v as DayRef, hour, minute);
          }}
        />
      </fieldset>

      <div className="flex gap-3">
        <Select
          label={copy.hour_label}
          value={hour}
          options={Array.from({ length: 24 }, (_, i) => ({
            value: i,
            label: `${i}${copy.hour_label}`,
          }))}
          onSelect={(v) => {
            setHour(v);
            emit(day, v, minute);
          }}
        />
        <Select
          label={copy.minute_label}
          value={minute}
          options={minutes.map((m) => ({
            value: m,
            label: `${String(m).padStart(2, "0")}${copy.minute_label}`,
          }))}
          onSelect={(v) => {
            setMinute(v);
            emit(day, hour, v);
          }}
        />
      </div>
    </div>
  );
}

/**
 * 드롭다운. 브라우저가 그려 주는 목록을 그대로 쓴다 — 폰에서는
 * 화면 아래에서 큰 휠이 올라오므로 직접 만든 목록보다 누르기 쉽다.
 *
 * 화살표는 우리가 그린다. appearance-none 을 주지 않으면 iOS 와 안드로이드의
 * 기본 화살표 크기가 달라 두 칸의 폭이 어긋나 보인다.
 */
function Select({
  label,
  value,
  options,
  onSelect,
}: {
  label: string;
  value: number | null;
  options: { value: number; label: string }[];
  onSelect: (v: number) => void;
}) {
  return (
    <div className="relative flex-1">
      <select
        aria-label={label}
        value={value ?? ""}
        onChange={(e) => onSelect(Number(e.target.value))}
        /**
         * 고르기 전과 후의 정렬이 다르다.
         *
         *   전 — 오른쪽. "시" · "분" 은 값이 아니라 이 칸이 무엇을 받는지
         *        알려주는 이름표다. 화살표 옆에 붙여 두면 "누르면 열린다"는
         *        신호가 한 덩어리로 읽힌다
         *   후 — 가운데. 이제 이 칸의 주인공은 고른 값이다
         *
         * 좌우 여백은 항상 같게 준다. 한쪽만 비우면 가운데 정렬이 어긋난다
         */
        className={`min-h-[60px] w-full appearance-none rounded-2xl border-2 bg-white px-10 text-[1.24rem] font-bold focus:ring-4 focus:ring-slate-300 ${
          value === null
            ? "border-slate-500 text-right text-slate-500"
            : "border-slate-900 text-center text-slate-900"
        }`}
      >
        <option value="" disabled>
          {label}
        </option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="pointer-events-none absolute top-1/2 right-3 h-6 w-6 -translate-y-1/2 text-slate-600"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </div>
  );
}

/**
 * 보기에는 버튼이지만 내용은 라디오 그룹이다 (S1 과 같다).
 * 테두리는 slate-500 이상 — slate-300 은 흰 배경 대비 1.5:1 로
 * WCAG 1.4.11(비텍스트 3:1) 미달이다.
 */
function Grid<T extends string | number>({
  columns,
  options,
  selected,
  onSelect,
}: {
  columns: string;
  options: { value: T; label: string }[];
  selected: T | null;
  onSelect: (v: T) => void;
}) {
  return (
    <div className={`grid ${columns} gap-2`}>
      {options.map((o) => {
        const on = selected === o.value;
        return (
          <label
            key={String(o.value)}
            className={`flex min-h-[52px] cursor-pointer items-center justify-center rounded-xl border-2 text-[1.06rem] font-bold ${
              on
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-500 bg-white text-slate-800"
            }`}
          >
            <input
              type="radio"
              checked={on}
              onChange={() => onSelect(o.value)}
              className="sr-only"
            />
            {o.label}
          </label>
        );
      })}
    </div>
  );
}

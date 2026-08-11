"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { saveAnswers } from "@/lib/answers";
import type {
  Answers,
  DayRef,
  Question,
  TimeAnswer,
} from "@/lib/questions";
import { emptyAnswers } from "@/lib/questions";

/**
 * S3 문답 — PRD §8 F2 · §10
 *
 * 1문 1화면. 한 화면에 하나만 물어야 고령 사용자가 놓치지 않는다.
 * 문항 정의는 lib/questions.ts 에 있다. 여기서는 그리기만 한다.
 *
 * 자유 텍스트 입력이 하나도 없다. 선택지는 전부 룰셋에서 온다.
 * 응답은 서버로 보내지 않는다.
 */
export default function QuestionFlow({
  questions,
  backHref,
}: {
  questions: Question[];
  backHref: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>(emptyAnswers());

  const question = questions[step];
  const isLast = step === questions.length - 1;

  function goBack() {
    if (step === 0) router.push(backHref);
    else setStep(step - 1);
  }

  function goNext() {
    if (isLast) {
      saveAnswers(answers);
      router.push(`/pet/card${window.location.search}`);
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

        <div className="mt-5">
          <Body
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
          onClick={goNext}
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
        <span className="text-[1.06rem] text-slate-600">
          답변은 저장되지 않습니다
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

/** 다음으로 넘어갈 수 있는지 */
function isAnswered(question: Question, a: Answers): boolean {
  switch (question.id) {
    case "lastMeal":
      return a.lastMeal !== null;
    case "intake":
      return a.intake !== null;
    case "medication":
      return (
        a.medication === null ||
        (a.medication.categories.length > 0 && a.medication.time !== null)
      );
    case "diabetes":
      return true; // 아니오가 기본값이다
    case "exercise":
      return a.exercise !== null;
    case "flags":
      return true; // 해당 없음이 정상이다
    default:
      return true;
  }
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
  onAdvance: () => void;
}) {
  const [showDetail, setShowDetail] = useState(false);

  switch (question.kind) {
    case "time":
      return (
        <TimePicker
          value={answers.lastMeal}
          onChange={(t) => onChange({ ...answers, lastMeal: t })}
        />
      );

    case "optional_categories": {
      const has = answers.intake.length > 0 || showDetail;
      return (
        <>
          <TwoChoice
            noneLabel={question.noneLabel!}
            someLabel={question.someLabel!}
            isNone={!has}
            onNone={() => {
              setShowDetail(false);
              onChange({ ...answers, intake: [] });
              onAdvance();
            }}
            onSome={() => setShowDetail(true)}
          />
          {has && (
            <MultiSelect
              className="mt-4"
              options={question.options!}
              selected={answers.intake}
              onToggle={(id) =>
                onChange({ ...answers, intake: toggle(answers.intake, id) })
              }
            />
          )}
        </>
      );
    }

    case "optional_categories_time": {
      const med = answers.medication;
      return (
        <>
          <TwoChoice
            noneLabel={question.noneLabel!}
            someLabel={question.someLabel!}
            isNone={med === null && !showDetail}
            onNone={() => {
              setShowDetail(false);
              onChange({ ...answers, medication: null });
              onAdvance();
            }}
            onSome={() => {
              setShowDetail(true);
              if (!med)
                onChange({
                  ...answers,
                  medication: { categories: [], time: null },
                });
            }}
          />
          {(med || showDetail) && (
            <>
              <MultiSelect
                className="mt-4"
                options={question.options!}
                selected={med?.categories ?? []}
                onToggle={(id) =>
                  onChange({
                    ...answers,
                    medication: {
                      categories: toggle(med?.categories ?? [], id),
                      time: med?.time ?? null,
                    },
                  })
                }
              />
              <p className="mt-5 mb-3 text-[1.18rem] font-bold text-slate-900">
                {question.timeTitle}
              </p>
              <TimePicker
                value={med?.time ?? null}
                onChange={(t) =>
                  onChange({
                    ...answers,
                    medication: {
                      categories: med?.categories ?? [],
                      time: t,
                    },
                  })
                }
              />
            </>
          )}
        </>
      );
    }

    case "yes_no_time":
      return (
        <>
          <TwoChoice
            noneLabel={question.noneLabel!}
            someLabel={question.someLabel!}
            isNone={answers.diabetes === null && !showDetail}
            onNone={() => {
              setShowDetail(false);
              onChange({ ...answers, diabetes: null });
              onAdvance();
            }}
            onSome={() => setShowDetail(true)}
          />
          {(answers.diabetes || showDetail) && (
            <>
              <p className="mt-5 mb-3 text-[1.18rem] font-bold text-slate-900">
                {question.timeTitle}
              </p>
              <TimePicker
                value={answers.diabetes}
                onChange={(t) => onChange({ ...answers, diabetes: t })}
              />
            </>
          )}
        </>
      );

    case "yes_no":
      return (
        <TwoChoice
          noneLabel={question.noneLabel!}
          someLabel={question.someLabel!}
          isNone={answers.exercise === false}
          isSome={answers.exercise === true}
          onNone={() => {
            onChange({ ...answers, exercise: false });
            onAdvance();
          }}
          onSome={() => {
            onChange({ ...answers, exercise: true });
            onAdvance();
          }}
        />
      );

    case "flags":
      return (
        <MultiSelect
          stacked
          options={question.options!}
          selected={answers.flags}
          onToggle={(id) =>
            onChange({ ...answers, flags: toggle(answers.flags, id) })
          }
        />
      );
  }
}

function toggle(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

function TwoChoice({
  noneLabel,
  someLabel,
  isNone,
  isSome,
  onNone,
  onSome,
}: {
  noneLabel: string;
  someLabel: string;
  isNone: boolean;
  isSome?: boolean;
  onNone: () => void;
  onSome: () => void;
}) {
  const base =
    "min-h-[68px] flex-1 rounded-2xl border-2 text-[1.24rem] font-bold";
  const on = "border-slate-900 bg-slate-900 text-white";
  const off = "border-slate-500 bg-white text-slate-800";

  return (
    <div className="flex gap-3">
      <button
        type="button"
        onClick={onNone}
        aria-pressed={isNone}
        className={`${base} ${isNone ? on : off}`}
      >
        {noneLabel}
      </button>
      <button
        type="button"
        onClick={onSome}
        aria-pressed={isSome ?? !isNone}
        className={`${base} ${(isSome ?? !isNone) ? on : off}`}
      >
        {someLabel}
      </button>
    </div>
  );
}

function MultiSelect({
  options,
  selected,
  onToggle,
  className = "",
  stacked = false,
}: {
  options: { id: string; label: string }[];
  selected: string[];
  onToggle: (id: string) => void;
  className?: string;
  stacked?: boolean;
}) {
  return (
    <div
      className={`grid gap-2 ${stacked ? "grid-cols-1" : "grid-cols-2"} ${className}`}
    >
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
            <span
              aria-hidden="true"
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 ${
                on ? "border-white bg-white text-slate-900" : "border-slate-500"
              }`}
            >
              {on ? "✓" : ""}
            </span>
            {o.label}
          </label>
        );
      })}
    </div>
  );
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 10, 20, 30, 40, 50];

/**
 * 예약일 기준 어제/오늘 + 시 + 분. 절대 날짜를 묻지 않는다 — 환자가 헷갈린다.
 *
 * 셋을 모두 고르기 전에는 답으로 넘기지 않는다.
 * 기본값을 채워 두면 환자가 고르지 않은 시각이 요약카드에 찍히고,
 * 그 값으로 금식 위반 여부가 판정된다.
 */
function TimePicker({
  value,
  onChange,
}: {
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

  return (
    <div className="flex flex-col gap-4">
      <Row
        legend="날짜"
        columns="grid-cols-2"
        options={[
          { value: "yesterday", label: "어제" },
          { value: "today", label: "오늘" },
        ]}
        selected={day}
        onSelect={(v) => {
          setDay(v as DayRef);
          emit(v as DayRef, hour, minute);
        }}
      />
      <Row
        legend="몇 시"
        columns="grid-cols-6"
        options={HOURS.map((h) => ({ value: h, label: `${h}시` }))}
        selected={hour}
        onSelect={(v) => {
          setHour(v as number);
          emit(day, v as number, minute);
        }}
      />
      <Row
        legend="몇 분"
        columns="grid-cols-6"
        options={MINUTES.map((m) => ({
          value: m,
          label: `${String(m).padStart(2, "0")}분`,
        }))}
        selected={minute}
        onSelect={(v) => {
          setMinute(v as number);
          emit(day, hour, v as number);
        }}
      />
    </div>
  );
}

function Row<T extends string | number>({
  legend,
  columns,
  options,
  selected,
  onSelect,
}: {
  legend: string;
  columns: string;
  options: { value: T; label: string }[];
  selected: T | null;
  onSelect: (v: T) => void;
}) {
  return (
    <fieldset>
      {/* 라벨을 눈에 보이게 둔다. 없으면 "23시" 아래 "00분" 이 이어져
          두 그리드가 한 덩어리로 읽힌다 */}
      <legend className="mb-2 text-[1.06rem] font-bold text-slate-700">
        {legend}
      </legend>
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
    </fieldset>
  );
}

import { redirect } from "next/navigation";

import QuestionFlow from "@/components/QuestionFlow";
import { parseReservationParam } from "@/lib/reservationParam";
import { buildQuestions } from "@/lib/questions";
import { f18FdgPet } from "@/lib/rules";

/**
 * S3 — 상태 문답 (PRD §8 F2)
 *
 * 문항은 lib/questions.ts 에서 온다. **지금은 가안이다.**
 * W0 tally 의 "9번 기타" 원문 분석이 끝나면 T8에서 교체한다.
 *
 * 예약 정보가 없으면 여기서 시작할 수 없다. S1 으로 되돌린다.
 */
export default async function CheckScreen({
  searchParams,
}: {
  searchParams: Promise<{ t?: string; b?: string }>;
}) {
  const { t, b } = await searchParams;

  if (!parseReservationParam(t)) redirect("/");

  const backHref = `/pet?t=${t}${b ? `&b=${b}` : ""}`;

  return (
    <main className="flex flex-1 flex-col px-4 pt-5 pb-8">
      <QuestionFlow
        questions={buildQuestions(f18FdgPet)}
        backHref={backHref}
      />
    </main>
  );
}

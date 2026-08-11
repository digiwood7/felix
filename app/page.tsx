import { redirect } from "next/navigation";

import ReservationForm from "@/components/ReservationForm";
import { parseReservationParam } from "@/lib/reservationParam";
import { f18FdgPet } from "@/lib/rules";

/**
 * S1 — 날짜 · 시각 · 장소 입력 (PRD §10)
 *
 * ?t= 가 붙어 들어오면 입력 화면을 보여주지 않고 바로 타임라인으로 보낸다.
 * 안내지에 QR 이 정식 삽입되면(§15) 예약 일시가 mail-merge 되어 오므로
 * 환자는 이 화면을 아예 보지 않게 된다. 그게 목표 상태다.
 *
 * 개인 식별 정보를 받지 않는다. 검사 종류 + 일시 + 건물 조합으로는
 * 개인을 특정할 수 없다 (PRD §14).
 */
export default async function InputScreen({
  searchParams,
}: {
  searchParams: Promise<{ t?: string; b?: string }>;
}) {
  const { t, b } = await searchParams;

  if (parseReservationParam(t)) {
    redirect(`/pet?t=${t}${b ? `&b=${b}` : ""}`);
  }

  return (
    <main className="flex-1 px-4 pt-6 pb-8">
      <header className="mb-6">
        <h1 className="text-[1.65rem] leading-tight font-extrabold text-slate-900">
          검사 준비 안내
        </h1>
        <p className="mt-2 text-[1.12rem] leading-relaxed text-slate-700">
          예약하신 날짜와 시각을 입력하면 준비 일정을 알려드립니다
        </p>
      </header>

      <ReservationForm ruleset={f18FdgPet} />
    </main>
  );
}

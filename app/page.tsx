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
        {/* 명사가 이어지면 띄어 쓴다 — "검사준비안내" (X) / "검사 준비 안내" (O) */}
        <h1 className="text-[1.65rem] leading-tight font-extrabold text-slate-900">
          핵의학과 PET 검사 준비 안내
        </h1>
        <p className="mt-2 text-[1.12rem] leading-relaxed text-slate-700">
          PET 검사 예약 날짜와 시간을 선택하시면 준비 일정을 알려드립니다.
        </p>
        {/* 안내지를 잃어버린 환자가 여기서 막힌다. 찾을 곳을 먼저 알려 준다 */}
        <p className="mt-1 text-[1.06rem] leading-relaxed text-slate-600">
          예약 안내문이나 예약 문자에서 확인하실 수 있습니다.
        </p>
      </header>

      <ReservationForm ruleset={f18FdgPet} />
    </main>
  );
}

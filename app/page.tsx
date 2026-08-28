import { redirect } from "next/navigation";

import LogView from "@/components/LogView";
import ReservationForm from "@/components/ReservationForm";
import { parseReservationParam } from "@/lib/reservationParam";
import { f18FdgPet } from "@/lib/rules";
import { locationParam, oneParam } from "@/lib/searchParam";

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
  searchParams: Promise<{ t?: string | string[]; b?: string | string[] }>;
}) {
  const params = await searchParams;
  const t = oneParam(params.t);
  // 받은 값을 그대로 주소에 되돌려 넣지 않는다. 제어 문자가 섞여 오면
  // 리다이렉트 헤더가 깨진다 (`?b=%00`)
  const b = locationParam(f18FdgPet, params.b);

  if (parseReservationParam(t)) {
    redirect(`/pet?t=${t}${b ? `&b=${b}` : ""}`);
  }

  return (
    <main className="flex-1 px-4 pt-6 pb-8">
      {/* 예약을 아직 모르므로 상대 거리는 남지 않는다 */}
      <LogView screen="s1" />

      {/* 첫 화면에서 "이게 뭐 하는 화면인지" 를 먼저 세운다.
          S2 의 예약 카드와 같은 형태(짙은 판)라 두 화면이 한 서비스로 읽힌다 */}
      {/* 첫 화면에서 "이게 뭐 하는 화면인지" 를 먼저 세운다.
          S2 의 예약 카드와 같은 형태(짙은 판)라 두 화면이 한 서비스로 읽힌다.

          **크기 차이만으로는 제목이 서지 않는다.** 셋을 같은 회색조로 두면
          큰 글씨가 아니라 긴 덩어리로 읽힌다. 그래서 세 층을 색으로도
          가른다 — 발신자(흐림) · 제목(흰색) · 설명(중간). */}
      <header className="mb-6 rounded-2xl bg-slate-900 px-5 pt-5 pb-6 text-white">
        {/* 병원명은 발신자 표기다. 제목과 같은 무게로 두면 제목이 세 줄이 된다.
            다만 **작아서도 안 된다** — 0.98rem 은 16.66px 로 PRD §13 의 본문
            최소치(17px)를 밑돌았다. 히어로 안에서 혼자 규칙 밖에 있었다.

            1.12rem(19px)은 제목(2.35rem)의 절반 아래라 경쟁하지 않으면서,
            흰 제목 옆에서 흐릿해 보이지 않는 최소선이다.
            색도 slate-400(6.96:1) → slate-300(12.02:1)으로 올린다.
            대비 기준은 둘 다 넘었지만, **기준을 넘는 것과 눈에 들어오는 것은
            다르다** — 바로 아래 흰 글씨가 2.35rem 이라 상대적으로 죽는다 */}
        <p className="text-[1.12rem] font-bold tracking-wide text-slate-300">
          삼성서울병원
        </p>
        {/* 명사가 이어지면 띄어 쓴다 — "검사준비안내" (X) / "검사 준비 안내" (O) */}
        <h1 className="mt-2 text-[2.35rem] leading-[1.15] font-extrabold tracking-[-0.02em]">
          핵의학과 PET
          <br />
          검사 준비 안내
        </h1>
        {/* 제목과 설명 사이를 선으로 끊는다. 여백만으로는 두 문단이 붙어 읽힌다 */}
        <div className="mt-5 mb-4 h-px bg-slate-700" />
        <p className="text-[1.12rem] leading-relaxed text-slate-200">
          PET 검사 예약 날짜와 시간을 입력해 주세요. 준비 일정과 주의사항을
          알려드립니다.
        </p>
        {/* 안내지를 잃어버린 환자가 여기서 막힌다. 찾을 곳을 먼저 알려 준다 */}
        <p className="mt-2 text-[1rem] leading-relaxed text-slate-400">
          (예약 안내문이나 예약 문자에서 확인할 수 있습니다)
        </p>
      </header>

      <ReservationForm ruleset={f18FdgPet} />
    </main>
  );
}

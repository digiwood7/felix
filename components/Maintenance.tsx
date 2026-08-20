import { f18FdgPet } from "@/lib/rules";

/**
 * kill switch가 켜졌을 때 모든 라우트를 대체하는 화면 — PRD §18 R5
 *
 * 계산 결과를 일절 보여주지 않는다. 환자를 사람에게 보내는 것이 목적이다.
 *
 * **여기에도 Disclaimer 가 붙는다** (CLAUDE.md 원칙 6). kill switch 가
 * 켜지면 이 화면이 환자가 보는 유일한 화면인데, 병원 전화번호만 큼직하게
 * 떠 있고 "병원 공식 서비스가 아니다" 가 없으면 네 화면 중 가장 병원
 * 공식 안내처럼 읽힌다. min-h-dvh 대신 flex-1 을 쓰는 이유도 그것이다 —
 * 화면 높이를 다 먹으면 Disclaimer 가 접히는 선 아래로 밀린다.
 *
 * **번호를 하드코딩하지 않고 룰셋에서 읽는다.**
 * 이 화면은 주소가 통째로 rewrite 되어 들어오므로 환자가 어느 건물로
 * 가는지 알 수 없다. 그렇다고 대표번호 하나로 보내면 교환을 거쳐 다시
 * 연결되고, 그 사이에 줄이려던 전화 응대가 두 번 일어난다. 그래서 건물을
 * 고르는 일을 환자에게 넘긴다 — 자기 예약 건물은 환자가 안다.
 *
 * 머리글과 안내 문장은 룰셋이 아니라 여기에 둔다. 이 화면은 검사 종류에
 * 딸린 화면이 아니라 서비스가 멈췄다는 사실을 알리는 화면이고, 무엇보다
 * **룰셋이 깨져도 떠야 하는 마지막 화면**이다. 번호만 룰셋에서 읽는 것은
 * 그것이 바뀌는 사실 정보이기 때문이다.
 */
export default function Maintenance() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-[1.65rem] leading-tight font-extrabold text-slate-900">
        지금은 안내를 제공하지 않습니다
      </h1>

      <p className="text-[1.12rem] leading-relaxed text-slate-700">
        검사 준비사항은 접수처 또는 아래 번호로 문의해 주세요.
      </p>

      <ul className="flex w-full max-w-xs flex-col gap-3">
        {f18FdgPet.locations.options.map((option) => (
          <li key={option.id}>
            <a
              // tel: 에는 숫자만 남긴다. `02)3410-2620` 의 괄호가 그대로
              // 들어가면 기기에 따라 걸리지 않는다
              href={`tel:${option.phone.replace(/[^0-9]/g, "")}`}
              className="flex min-h-[68px] flex-col items-center justify-center rounded-xl bg-slate-900 px-6 py-3 text-white"
            >
              <span className="text-[1.06rem] font-medium text-slate-300">
                {option.label}
              </span>
              <span className="text-[1.35rem] font-extrabold tabular-nums">
                {option.phone}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </main>
  );
}

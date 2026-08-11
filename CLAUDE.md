# PET Time

FDG PET 검사 준비 안내 웹서비스.

환자가 병원 도착 전에 자신의 검사 준비 상태를 스스로 정리해 오게 만들어,
핵의학과 접수 단계의 반복 문답을 줄이는 것이 목적이다.
**안내문 디지털화가 아니라 반복업무 감소 솔루션이다.**

| 문서 | 내용 |
|---|---|
| `PRD.md` | 무엇을 만들지 — 기능 명세, 룰셋, 계산 규칙, KPI |
| `WORKFLOW.md` | 어떤 순서로 만들지 — 작업 목록(T0~T13), 게이트, 측정 계획 |

세션 시작 시 두 문서를 먼저 읽는다. 한 세션 = 한 작업(T번호) = 커밋 1개.

---

## 타협 불가 원칙

1. **개인정보를 받지 않는다.**
   이름·등록번호·연락처·생년월일 입력 필드를 어떤 이유로도 추가하지 않는다.
   **자유 텍스트 입력 필드 자체를 만들지 않는다.** 문답 선택지는 룰셋에서 읽는다.
   원문이 생기는 순간 URL·공유·로그 세 곳에서 동시에 문제가 된다.

2. **의료 판단을 하지 않는다.**
   다음 표현을 생성하지 않는다:
   "검사 가능/불가", "괜찮습니다", "문제없습니다", "판단됩니다",
   "~일 수 있습니다"로 끝나는 추정 문장.
   출력은 룰셋 levels의 행동 지시 3종(ok/tell/call)뿐이다.

3. **모든 시각은 내림(floor) 처리한다.**
   금식 시작·복약 마지노선 → floor_hour / 도착 시각 → floor_10min.
   이르게 틀리는 방향으로만. 반올림 금지.
   **새벽 보정을 하지 않는다.** 계산값을 그대로 쓰고, 실행 조언이 필요하면
   룰셋 `fasting.note` 를 보조 한 줄로 붙인다.

4. **모든 계산은 KST 고정이다.**
   `new Date()` / `getHours()` 등 기기 로컬 타임존을 따르는 API를 계산 경로에 쓰지 않는다.
   룰셋 `timezone` 필드가 유일한 기준이다.

5. **병원 브랜드를 쓰지 않는다.**
   병원명·로고를 서비스 아이덴티티로 사용하지 않는다.
   연락처는 사실 정보로만 표기.

6. **모든 화면 하단에 Disclaimer를 넣는다.** (S1·S2·S3·S4 전부)
   "이 서비스는 병원 공식 서비스가 아니며, 검사 가능 여부를 판단하지 않습니다.
    최종 확인은 반드시 핵의학과 직원에게 받으세요."

---

## 아키텍처 규칙

- v1은 서버 상태를 갖지 않는다. 계산은 전부 클라이언트.
- 검사별 차이는 `lib/rules/*.json`으로만 표현한다. 코드에 검사별 분기를 넣지 않는다.
- 배지 판정은 룰셋 `flags` + `triage` 로만 한다. `lib/triage.ts` 에 조건문을 늘리지 않는다.
- 문구는 룰셋에서 읽는다. 컴포넌트에 하드코딩하지 않는다.
- 웹폰트를 추가하지 않는다. 시스템 폰트만.
- DB를 추가하지 않는다. 익명 로그만 KV.
- kill switch(`NEXT_PUBLIC_SERVICE_STATUS`)는 계산 로직보다 먼저 평가되어야 한다.

**룰셋 값이 틀렸으면 JSON을 고친다. 코드에 예외를 넣지 않는다.**
로직에 예외가 쌓이기 시작하면 검사 종류 확장이 불가능해진다.

---

## 커밋 전 확인

```bash
# 금지 표현 — 0건이어야 함
grep -rn "검사 가능\|검사 불가\|괜찮습니다\|문제없습니다\|판단됩니다" app/ lib/ components/

# 자유 텍스트 입력 — 0건이어야 함
grep -rn "<input type=\"text\"\|<textarea" app/ components/

npm test
```

커밋 메시지: `feat:` `fix:` `docs:` `chore:` `test:`

**룰셋 JSON을 바꾼 커밋은 본문에 근거를 남긴다** — 어느 안내지 몇 년 몇 월판인지.
나중에 "이 값이 왜 6시간이지?"를 추적할 수 있어야 한다.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

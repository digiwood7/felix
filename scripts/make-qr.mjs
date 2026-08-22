import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import QRCode from "qrcode";

/**
 * QR 이미지 생성 — WORKFLOW T13
 *
 * 실행: node scripts/make-qr.mjs
 *
 * **주소가 바뀌면 인쇄물을 전부 다시 만든다.** 그래서 손으로 만든 이미지를
 * 저장소에 넣지 않고 스크립트를 남긴다. 나중에 검사 종류가 늘어 경로가
 * 갈리거나 도메인을 옮길 때, 여기 상수 하나만 고치고 다시 돌리면 된다.
 *
 * qrcode 는 devDependency 다. 생성은 빌드 전에 한 번 끝나고 결과물만
 * public/qr/ 에 남으므로, 환자가 받는 번들에는 들어가지 않는다.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "..", "public", "qr");

/**
 * QR 이 담을 주소.
 *
 * `/pet` 이다 — 첫 화면(`/`)이 아니라 타임라인이다. QR 을 찍는 사람은
 * 이미 검사 종류가 정해져 있고, 스티커가 붙어 있는 곳이 핵의학과이므로
 * 검사를 고르는 화면을 한 번 더 거칠 이유가 없다.
 *
 * 스킴(`https://`)을 붙인다. 없으면 일부 스캐너가 주소가 아니라 글자로
 * 읽어 브라우저를 열지 않는다.
 */
const URL = "https://petct.kr/pet";

/**
 * 오류정정 레벨 H — 최고 등급. 코드의 약 30% 가 가려져도 읽힌다.
 *
 * 대기실 벽에 붙는 종이다. 모서리가 뜯기고, 손이 닿아 긁히고, 다른
 * 안내문이 겹쳐 붙는다. 담는 글자가 20자뿐이라 H 로 올려도 코드가
 * 거의 커지지 않으므로 낮출 이유가 없다.
 */
const ERROR_CORRECTION = "H";

/**
 * 여백(quiet zone) 4모듈 — 규격 최소값이다.
 *
 * 여백이 모자라면 스캐너가 코드의 경계를 못 찾는다. 스티커를 재단할 때
 * 이 흰 테두리를 잘라 내지 않도록 시안에서도 배경을 흰색으로 둔다.
 */
const MARGIN = 4;

await mkdir(OUT, { recursive: true });

// 인쇄용. 벡터라 3cm 로 뽑든 30cm 로 뽑든 가장자리가 뭉개지지 않는다
const svg = await QRCode.toString(URL, {
  type: "svg",
  errorCorrectionLevel: ERROR_CORRECTION,
  margin: MARGIN,
  color: { dark: "#000000", light: "#ffffff" },
});
await writeFile(join(OUT, "pet.svg"), svg);

// 화면 확인용. 1200px 이면 3cm 인쇄 기준 1000dpi 를 넘는다
await QRCode.toFile(join(OUT, "pet.png"), URL, {
  errorCorrectionLevel: ERROR_CORRECTION,
  margin: MARGIN,
  width: 1200,
  color: { dark: "#000000", light: "#ffffff" },
});

// 한 변의 모듈 수. 3cm 로 인쇄할 때 모듈 하나가 몇 mm 인지 계산하는 근거다
const modules = (await QRCode.create(URL, {
  errorCorrectionLevel: ERROR_CORRECTION,
})).modules.size;

console.log(`주소        ${URL}`);
console.log(`오류정정    ${ERROR_CORRECTION} (약 30% 손상까지 복원)`);
console.log(`모듈        ${modules} × ${modules} (여백 ${MARGIN} 제외)`);
console.log(
  `3cm 인쇄 시 모듈 하나 = ${(30 / (modules + MARGIN * 2)).toFixed(2)}mm`,
);
console.log(`생성        public/qr/pet.svg · public/qr/pet.png`);

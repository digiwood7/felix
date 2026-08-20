import { DISCLAIMER } from "./disclaimer";
import type { ExamRuleset, TimelineItemKind } from "./rules/types";
import type { Reservation, Timeline, TimelineItem } from "./schedule";

/**
 * 캘린더 파일(.ics) 생성 — PRD §8 F3
 *
 * 금식 시작과 도착, 두 시점을 기기 캘린더에 넣는다. 발송 서버가 없으므로
 * 알림은 기기가 울린다. 이 서비스가 환자에게 무언가를 보내는 유일한
 * 방법이자, **정보가 필요한 순간에 손에 있게 만드는** 방법이다 —
 * 종이 안내지가 실패하는 지점이 정확히 거기다 (PRD §2.2).
 *
 * 시각은 KST 고정이다. `TZID=Asia/Seoul` 로 적고 VTIMEZONE 을 함께 넣는다.
 * UTC(Z)로 바꿔 적으면 해외에 있는 보호자의 캘린더에서 다른 시각으로
 * 보인다 — 이 지시는 "서울 벽시계로 2시" 이지 어떤 절대 순간이 아니다.
 *
 * 한국은 서머타임이 없으므로 오프셋은 항상 +0900 이다.
 */

const TZID = "Asia/Seoul";
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** RFC 5545 는 한 줄을 75옥텟으로 제한한다 */
const LINE_OCTETS = 75;

interface IcsEvent {
  /** KST 벽시계를 UTC 로 간주한 epoch (lib/schedule.ts 와 같은 방식) */
  start: number;
  summary: string;
  description: string[];
  uid: string;
}

export function buildIcs(ruleset: ExamRuleset, timeline: Timeline): string {
  const events = collectEvents(ruleset, timeline);

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//pet-time//${ruleset.id}//KO`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...timezoneBlock(),
    ...events.flatMap((event) => eventBlock(event, events)),
    "END:VCALENDAR",
  ];

  // RFC 5545 는 CRLF 를 요구한다. LF 만 쓰면 일부 캘린더가 통째로 거부한다
  return lines.flatMap(fold).join("\r\n") + "\r\n";
}

/** "pet-checkup-20260820.ics" — 개인을 가리키는 글자가 들어가지 않는다 */
export function icsFilename(ruleset: ExamRuleset, r: Reservation): string {
  return `${ruleset.actions.calendar_file}-${pad(r.year, 4)}${pad(r.month)}${pad(r.day)}.ics`;
}

/**
 * 두 일정 모두 **시점 하나**로 찍는다. 길이를 주지 않는다.
 *
 * 금식은 "이 시각 이후" 라 끝이 없고, 도착은 "이 시각까지 오세요" 라
 * 끝이 없다. 길이를 붙이면 캘린더가 `09:00~09:30` 처럼 띠로 그리는데,
 * 그 뒤쪽 시각은 안내지에 없는 값이라 환자가 "9시 30분까지는 먹어도
 * 되나" 로 읽을 여지가 생긴다. 서비스가 만들어 낸 시각은 주지 않는다.
 *
 * 규격상으로도 이쪽이 맞다 — DTEND 없이 DTSTART 만 있는 일정은
 * "같은 시각에 끝나는" 일정이다 (RFC 5545 3.6.1). DTEND 를 DTSTART 와
 * 같게 적는 것은 오히려 위반이다 (3.8.2.2 — DTEND 는 뒤여야 한다).
 */
function collectEvents(ruleset: ExamRuleset, timeline: Timeline): IcsEvent[] {
  const events: IcsEvent[] = [];

  for (const kind of ["fasting", "arrival"] as const) {
    const found = findItem(timeline, kind);
    if (!found) continue;

    const start = epochOf(found.date, found.item.time!);
    events.push({
      start,
      summary: summaryOf(ruleset, found.item),
      description: found.item.notes,
      uid: uidOf(ruleset, kind, start),
    });
  }

  return events;
}

/**
 * 제목은 룰셋에서 온다. 화면에 뜬 지시문 그대로다.
 *
 * 캘린더 알림은 화면 밖에서 뜬다. 거기서 다른 말이 나오면 환자는 어느
 * 쪽이 맞는지 알 수 없다.
 */
function summaryOf(ruleset: ExamRuleset, item: TimelineItem): string {
  return `[${ruleset.labels[item.kind]}] ${item.text}`;
}

function findItem(
  timeline: Timeline,
  kind: TimelineItemKind,
): { date: string; item: TimelineItem } | null {
  for (const day of timeline) {
    for (const item of day.items) {
      if (item.kind === kind && item.time) return { date: day.date, item };
    }
  }
  return null;
}

function eventBlock(event: IcsEvent, all: IcsEvent[]): string[] {
  return [
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    // 파일을 만든 시각이 아니라 **가장 이른 일정 시각**을 쓴다. 지금 시각을
    // 넣으면 같은 예약에서 매번 다른 파일이 나와 테스트가 흔들리고,
    // 기기 시계가 계산 결과에 스며드는 통로가 하나 생긴다 (PRD §9.2)
    `DTSTAMP:${formatUtc(Math.min(...all.map((e) => e.start)))}`,
    // DTEND 를 적지 않는다. 이 일정은 길이가 아니라 시점이다
    `DTSTART;TZID=${TZID}:${formatLocal(event.start)}`,
    `SUMMARY:${escapeText(event.summary)}`,
    `DESCRIPTION:${escapeText([...event.description, DISCLAIMER].join("\n"))}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeText(event.summary)}`,
    // 일정 시각에 울린다. 금식은 "이 시각 이후" 라 그때가 맞고,
    // 도착은 계산에서 이미 20분 앞당겨져 있다
    "TRIGGER:PT0S",
    "END:VALARM",
    "END:VEVENT",
  ];
}

/**
 * 서머타임이 없으므로 규칙 없이 오프셋 하나면 된다.
 *
 * TZID 만 적고 이 블록을 빼면 규격 위반이고, 일부 캘린더가 시각을
 * 자기 지역 시간으로 읽어 버린다.
 */
function timezoneBlock(): string[] {
  return [
    "BEGIN:VTIMEZONE",
    `TZID:${TZID}`,
    "BEGIN:STANDARD",
    "DTSTART:19700101T000000",
    "TZOFFSETFROM:+0900",
    "TZOFFSETTO:+0900",
    "TZNAME:KST",
    "END:STANDARD",
    "END:VTIMEZONE",
  ];
}

/**
 * 같은 예약이면 같은 UID 가 나온다.
 *
 * 두 번 받아도 일정이 두 개로 늘지 않고 덮어쓰인다. 환자가 불안해서
 * 여러 번 누르는 화면이라 이게 중요하다. 개인을 가리키는 값은 들어가지
 * 않는다 — 검사 종류와 시각뿐이다.
 */
function uidOf(ruleset: ExamRuleset, kind: string, epoch: number): string {
  return `${ruleset.id}-${kind}-${formatLocal(epoch)}@pet-time`;
}

/** "2026-08-20" + "02:00" → KST 벽시계를 UTC 로 간주한 epoch */
function epochOf(date: string, time: string): number {
  return Date.UTC(
    Number(date.slice(0, 4)),
    Number(date.slice(5, 7)) - 1,
    Number(date.slice(8, 10)),
    Number(time.slice(0, 2)),
    Number(time.slice(3, 5)),
  );
}

/** "20260820T020000" — TZID 와 함께 쓰는 지역 시각 표기 */
function formatLocal(epoch: number): string {
  const d = new Date(epoch);
  return (
    `${pad(d.getUTCFullYear(), 4)}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00`
  );
}

/** "20260819T170000Z" — KST 벽시계에서 9시간을 빼면 진짜 UTC 다 */
function formatUtc(epoch: number): string {
  return `${formatLocal(epoch - KST_OFFSET_MS)}Z`;
}

function pad(n: number, width = 2): string {
  return String(n).padStart(width, "0");
}

/** RFC 5545 TEXT — 역슬래시 · 세미콜론 · 쉼표 · 줄바꿈은 그대로 못 쓴다 */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/**
 * 한 줄을 75옥텟으로 자르고, 이어지는 줄은 공백 하나로 시작한다.
 *
 * **글자 수가 아니라 바이트 수다.** 한글은 UTF-8 에서 3바이트라 40자만
 * 넘어도 제한을 넘는다. 접지 않으면 긴 한글 설명이 들어간 파일을 일부
 * 캘린더가 통째로 거부한다.
 *
 * 글자 중간에서 자르지 않는다. 잘린 바이트는 깨진 글자가 된다.
 */
function fold(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let octets = 0;

  for (const char of line) {
    const size = octetsOf(char);
    // 이어지는 줄은 앞의 공백 한 칸을 쓰므로 74옥텟만 담을 수 있다
    const limit = out.length === 0 ? LINE_OCTETS : LINE_OCTETS - 1;

    if (octets + size > limit) {
      out.push(current);
      current = "";
      octets = 0;
    }

    current += char;
    octets += size;
  }

  out.push(current);
  return out.map((part, i) => (i === 0 ? part : ` ${part}`));
}

function octetsOf(char: string): number {
  const code = char.codePointAt(0)!;
  if (code < 0x80) return 1;
  if (code < 0x800) return 2;
  if (code < 0x10000) return 3;
  return 4;
}

// 홈 화면 첫 로딩 렉 측정용 — dev 빌드에서만 작동, prod는 no-op.
// 사용 후 제거 또는 비활성화 권장.

const ENABLED = __DEV__;
const T0 = Date.now();
const marks = new Map<string, number>();

const fmt = (ms: number) => `${ms.toString().padStart(5, ' ')}ms`;

export function mark(name: string): void {
  if (!ENABLED) return;
  const now = Date.now();
  marks.set(name, now);
  console.log(`[PERF] ${fmt(now - T0)} | ${name}`);
}

export function measure(from: string, to: string, label?: string): void {
  if (!ENABLED) return;
  const start = marks.get(from);
  const end = marks.get(to);
  if (start == null || end == null) {
    console.log(`[PERF] ⚠ measure missing mark: ${from} → ${to}`);
    return;
  }
  console.log(`[PERF] Δ ${fmt(end - start)} | ${label ?? `${from} → ${to}`}`);
}

// Promise 실행 시간 측정 — Promise.all 내부에서 개별 API 시간 분리해서 보기 위함.
export async function timed<T>(name: string, p: Promise<T>): Promise<T> {
  if (!ENABLED) return p;
  const s = Date.now();
  try {
    const v = await p;
    console.log(`[PERF API] ${fmt(Date.now() - s)} | ${name} ✓`);
    return v;
  } catch (e) {
    console.log(`[PERF API] ${fmt(Date.now() - s)} | ${name} ✗`);
    throw e;
  }
}

// 동기 블록 측정 — useMemo 등 메인 스레드 블락 측정용.
export function timeSync<T>(name: string, fn: () => T): T {
  if (!ENABLED) return fn();
  const s = Date.now();
  const v = fn();
  const dt = Date.now() - s;
  if (dt >= 1) console.log(`[PERF SYNC] ${fmt(dt)} | ${name}`);
  return v;
}

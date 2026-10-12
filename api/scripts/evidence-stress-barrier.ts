// Disposable stress instrumentation only. Hold real provider buffers until the
// parent has observed admission; do not rely on OS TCP receive-window timing.
export class StressDownloadBarrier {
  private gate: Promise<void> | undefined;
  private releaseGate: (() => void) | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private held = 0;
  arm(): void {
    if (this.gate || this.held) throw new Error('EVIDENCE_STRESS_BARRIER_ALREADY_ACTIVE');
    this.gate = new Promise<void>((resolve) => {
      this.releaseGate = resolve;
    });
    this.timer = setTimeout(() => this.release(), 30000);
  }
  async wait(): Promise<void> {
    const gate = this.gate;
    if (!gate) return;
    this.held += 1;
    try {
      await gate;
    } finally {
      this.held -= 1;
    }
  }
  release(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    this.gate = undefined;
    this.releaseGate?.();
    this.releaseGate = undefined;
  }
  count(): number {
    return this.held;
  }
}

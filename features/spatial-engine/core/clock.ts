export class Clock {
  private start = 0
  private last = 0
  elapsed = 0
  dt = 0
  running = false

  startClock(): void {
    const now = performance.now()
    this.start = now
    this.last = now
    this.elapsed = 0
    this.dt = 0
    this.running = true
  }

  tick(): { dt: number; elapsed: number } {
    const now = performance.now()
    this.dt = Math.min(0.1, (now - this.last) / 1000)
    this.last = now
    this.elapsed = (now - this.start) / 1000
    return { dt: this.dt, elapsed: this.elapsed }
  }

  stop(): void {
    this.running = false
  }
}

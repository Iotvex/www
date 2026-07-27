/**
 * Animation hooks — clips bind to node ids; evaluation is optional later.
 */
export type AnimTrack = {
  nodeId: string
  property: "position" | "rotation" | "scale"
  keyframes: { t: number; value: number[] }[]
}

export type AnimClip = {
  id: string
  name: string
  duration: number
  tracks: AnimTrack[]
}

export class AnimationService {
  private clips = new Map<string, AnimClip>()
  playing: string | null = null
  time = 0

  add(clip: AnimClip): void {
    this.clips.set(clip.id, clip)
  }

  list(): AnimClip[] {
    return [...this.clips.values()]
  }

  play(id: string): void {
    if (this.clips.has(id)) {
      this.playing = id
      this.time = 0
    }
  }

  stop(): void {
    this.playing = null
  }

  /** Stub tick — full evaluator comes in a later increment. */
  tick(_dt: number): void {
    if (!this.playing) return
    this.time += _dt
  }
}

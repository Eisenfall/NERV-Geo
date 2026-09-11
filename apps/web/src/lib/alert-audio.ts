interface AudioElementLike {
  currentTime: number;
  muted: boolean;
  play(): Promise<void>;
  pause(): void;
}

export class AlertAudio {
  constructor(private readonly element: AudioElementLike) {}

  get muted(): boolean {
    return this.element.muted;
  }

  async play(): Promise<void> {
    this.element.currentTime = 0;
    await this.element.play();
  }

  toggleMuted(): boolean {
    this.element.muted = !this.element.muted;
    return this.element.muted;
  }

  stop(): void {
    this.element.pause();
    this.element.currentTime = 0;
  }
}

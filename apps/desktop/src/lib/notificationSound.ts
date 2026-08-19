/**
 * Notification Sound Synthesizer using Web Audio API.
 * Generates clean, modern, zero-dependency harmonic notification chimes.
 */

class NotificationAudio {
  private ctx: AudioContext | null = null;
  private enabled: boolean = true;

  constructor() {
    // Check if user disabled sounds in localStorage
    const stored = localStorage.getItem("sordi_notification_sound_enabled");
    if (stored !== null) {
      this.enabled = stored === "true";
    }
  }

  private getAudioContext(): AudioContext | null {
    try {
      if (!this.ctx || this.ctx.state === "closed") {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      }
      if (this.ctx && this.ctx.state === "suspended") {
        this.ctx.resume();
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public setEnabled(val: boolean) {
    this.enabled = val;
    localStorage.setItem("sordi_notification_sound_enabled", String(val));
  }

  public play(type: "success" | "error" | "warning" | "info" | "default" = "default") {
    if (!this.enabled) return;

    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;

      if (type === "success") {
        // Modern 2-tone bright rising chime (E5 -> A5)
        this.playTone(ctx, 659.25, now, 0.08, 0.15, "sine");
        this.playTone(ctx, 880.00, now + 0.07, 0.18, 0.20, "sine");
      } else if (type === "error") {
        // Soft double low tone (D4 -> Bb3)
        this.playTone(ctx, 293.66, now, 0.09, 0.18, "triangle");
        this.playTone(ctx, 233.08, now + 0.08, 0.16, 0.22, "triangle");
      } else if (type === "warning") {
        // Gentle single amber tone (F#5)
        this.playTone(ctx, 739.99, now, 0.14, 0.18, "sine");
      } else {
        // Crisp subtle pop chime (G5)
        this.playTone(ctx, 783.99, now, 0.12, 0.16, "sine");
      }
    } catch {
      // Audio playback fails silently if browser blocks autoplay before user gesture
    }
  }

  private playTone(
    ctx: AudioContext,
    frequency: number,
    startTime: number,
    duration: number,
    volume: number,
    type: OscillatorType
  ) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, startTime);

    // Smooth envelope attack and decay to prevent clicking
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(volume, startTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration);
  }
}

export const notificationAudio = new NotificationAudio();

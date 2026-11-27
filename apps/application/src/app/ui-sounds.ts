type Sound = "select" | "confirmed" | "press" | "navigate";

const volume: Record<Sound, number> = { press: .13, navigate: .14, select: .16, confirmed: .21 };
let lastPlayed = -Infinity;
let current: HTMLAudioElement | undefined;

export function stopUiSound() {
  current?.pause();
}

export function playUiSound(sound: Sound) {
  try {
    const preferences = JSON.parse(localStorage.getItem("yespiz.profile.sounds") ?? "{}");
    if (preferences?.sound === false) return;
    const now = performance.now();
    if (sound !== "confirmed" && now - lastPlayed < 90) return;
    lastPlayed = now;
    stopUiSound();
    current = new Audio("/sounds/" + sound + ".wav");
    current.volume = volume[sound];
    void current.play().catch(() => {});
  } catch {
    // Unavailable storage or audio must not interrupt the interaction.
  }
}

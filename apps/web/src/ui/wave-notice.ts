export function waveAnnouncement(wave: number, time: number, running: boolean) {
  const age = time - wave * 60;
  return running && age >= 0 && age < 2.6 ? wave + 1 : null;
}

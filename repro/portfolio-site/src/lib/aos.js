// Thin wrapper so components that add [data-aos] elements after load can ask AOS to rescan.
let instance = null;

export async function initAOS(disable) {
  const { default: AOS } = await import('aos');
  instance = AOS;
  AOS.init({ once: true, duration: 800, easing: 'ease-out-cubic', offset: 60, delay: 0, disable });
  window.addEventListener('load', () => AOS.refresh(), { once: true });
  return AOS;
}

export function refreshAOS() {
  if (!instance) return;
  window.requestAnimationFrame(() => instance.refreshHard());
}

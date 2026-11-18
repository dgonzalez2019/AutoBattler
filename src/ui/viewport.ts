import Phaser from 'phaser';
import { H, W } from './theme';

/**
 * Responsive canvas: every scene is laid out in a fixed W x H (1280 x 720)
 * design area. On wider screens the canvas grows sideways to match the
 * screen's shape (no black bars), the camera keeps the design area centred,
 * and backgrounds extend into the extra space.
 */
export const MAX_W = 2800;

/** Canvas width that matches the window's aspect ratio at the design height. */
export function viewWidth(): number {
  const aspect = window.innerWidth / Math.max(1, window.innerHeight);
  return Math.round(Phaser.Math.Clamp(H * aspect, W, MAX_W));
}

/** How far the background should extend past the design area on each side. */
export const BLEED = (MAX_W - W) / 2;

/** Keep the design area centred in this scene's camera, now and on every resize. */
export function fitCamera(scene: Phaser.Scene) {
  const apply = () => scene.cameras.main.setScroll(-(scene.scale.width - W) / 2, 0);
  apply();
  scene.scale.on('resize', apply);
  scene.events.once('shutdown', () => scene.scale.off('resize', apply));
}

/** Resize the canvas when the window changes shape (rotation, browser bars). */
export function watchWindow(game: Phaser.Game) {
  let timer = 0;
  const onResize = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      const w = viewWidth();
      if (w !== game.scale.width) game.scale.setGameSize(w, H);
    }, 120);
  };
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);
}

/** Running as an installed home-screen app (already fullscreen)? */
export function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: fullscreen), (display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

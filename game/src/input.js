// Keyboard and mouse input. The canvas reports mouse positions in screen
// pixels; `toLogical` (set by main.js) maps them into the game's 1280x720
// logical field. Edge-triggered presses are consumed once per frame.
export class Input {
  constructor() {
    this.keys = new Set();
    this.pressed = new Set();
    this.mouse = { x: 640, y: 300, down: false };
    this.clicked = false;
    this.clickX = 0;
    this.clickY = 0;
    this.toLogical = null;
  }

  attach(canvas, toLogical) {
    this.toLogical = toLogical;
    window.addEventListener('keydown', (event) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
        event.preventDefault();
      }
      if (!event.repeat) this.pressed.add(event.code);
      this.keys.add(event.code);
    });
    window.addEventListener('keyup', (event) => {
      this.keys.delete(event.code);
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
    });
    canvas.addEventListener('mousemove', (event) => {
      const point = this.toLogical(event.clientX, event.clientY);
      this.mouse.x = point.x;
      this.mouse.y = point.y;
    });
    canvas.addEventListener('mousedown', (event) => {
      const point = this.toLogical(event.clientX, event.clientY);
      this.mouse.x = point.x;
      this.mouse.y = point.y;
      this.mouse.down = true;
      this.clicked = true;
      this.clickX = point.x;
      this.clickY = point.y;
    });
    window.addEventListener('mouseup', () => {
      this.mouse.down = false;
    });
  }

  /** Normalised movement vector from WASD / arrow keys. */
  axis() {
    let x = 0;
    let y = 0;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y += 1;
    if (x !== 0 && y !== 0) {
      const len = Math.hypot(x, y);
      x /= len;
      y /= len;
    }
    return { x, y };
  }

  dashPressed() {
    return this.wasPressed('Space') || this.wasPressed('ShiftLeft') || this.wasPressed('ShiftRight');
  }

  wasPressed(code) {
    if (this.pressed.has(code)) {
      this.pressed.delete(code);
      return true;
    }
    return false;
  }

  /** A mouse click this frame, in logical coordinates, or null. */
  takeClick() {
    if (!this.clicked) return null;
    this.clicked = false;
    return { x: this.clickX, y: this.clickY };
  }

  /** Clear edge-triggered state at the end of a frame. */
  endFrame() {
    this.pressed.clear();
    this.clicked = false;
  }
}

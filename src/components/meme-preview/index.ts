export class MemePreviewComponent {
  private container: HTMLElement;
  private currentImage: HTMLImageElement | null = null;
  private currentPath: string | null = null;
  
  // Maps to lookup the SVG path
  private gestureMap: Record<string, string> = {};
  private expressionMap: Record<string, string> = {};
  
  private idleContainer: HTMLElement;

  constructor(container: HTMLElement, mappingsData: any) {
    this.container = container;
    this.container.style.position = 'relative';
    this.container.style.width = '100%';
    this.container.style.height = '100%';
    this.container.style.display = 'flex';
    this.container.style.alignItems = 'center';
    this.container.style.justifyContent = 'center';
    
    // Parse mappings
    if (mappingsData) {
      if (mappingsData.gestures) {
        mappingsData.gestures.forEach((g: any) => {
          if (g.templateImage) this.gestureMap[g.id] = g.templateImage;
        });
      }
      if (mappingsData.expressions) {
        mappingsData.expressions.forEach((e: any) => {
          if (e.templateImage) this.expressionMap[e.id] = e.templateImage;
        });
      }
    }

    // Idle state
    this.idleContainer = document.createElement('div');
    this.idleContainer.className = 'hud-status-pill';
    this.idleContainer.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      transition: opacity 0.2s ease-in-out;
      opacity: 1;
      padding: 8px 16px;
      border: 1px solid var(--border-color);
      background: var(--bg-deep);
    `;
    this.idleContainer.innerHTML = `
      <span class="hud-status-dot gray"></span>
      <span style="font-size: 11px; font-weight: bold; color: var(--text-muted); letter-spacing: 0.1em;">SHOW A GESTURE</span>
    `;
    this.container.appendChild(this.idleContainer);
  }

  public update(gestureLabel: string | null, expressionLabel: string | null, comboLabel: string | null): void {
    let targetSvgPath: string | null = null;

    if (comboLabel) {
      // In combos, we generally map to the gesture's template or a combo specific one.
      // The instructions say "any gesture NOT in this set falls back to a generic matching placeholder".
      // Let's prioritize gesture over expression.
    }

    if (gestureLabel && this.gestureMap[gestureLabel]) {
      targetSvgPath = this.gestureMap[gestureLabel];
    } else if (expressionLabel && this.expressionMap[expressionLabel]) {
      targetSvgPath = this.expressionMap[expressionLabel];
    } else if (gestureLabel || expressionLabel) {
      // Something detected, but no specific template image -> fallback
      targetSvgPath = '/src/assets/meme-templates/no_detection.svg';
    }

    if (!gestureLabel && !expressionLabel && !comboLabel) {
      targetSvgPath = null;
    }

    if (this.currentPath === targetSvgPath) {
      return; // No change
    }
    
    this.currentPath = targetSvgPath;

    // Fade out idle container if we have an image
    this.idleContainer.style.opacity = targetSvgPath ? '0' : '1';

    // Transition image
    if (this.currentImage) {
      const oldImg = this.currentImage;
      oldImg.classList.remove('meme-pop-active');
      oldImg.classList.add('meme-pop-out');
      setTimeout(() => {
        if (oldImg.parentNode) oldImg.parentNode.removeChild(oldImg);
      }, 200);
    }

    if (targetSvgPath) {
      const newImg = document.createElement('img');
      newImg.src = targetSvgPath;
      newImg.className = 'meme-pop-base meme-pop-in';
      
      this.container.appendChild(newImg);
      
      // Trigger reflow then transition to active state
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          newImg.classList.remove('meme-pop-in');
          newImg.classList.add('meme-pop-active');
        });
      });
      this.currentImage = newImg;
    } else {
      this.currentImage = null;
    }
  }
}

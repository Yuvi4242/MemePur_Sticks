export class TVFrameComponent {
  private container: HTMLElement;
  private wrapper: HTMLDivElement;
  private glowColor: string;
  
  constructor(container: HTMLElement, title: string, contentEl: HTMLElement) {
    this.container = container;
    
    // Choose glow color based on title (Camera vs Preview)
    this.glowColor = title === 'CAMERA_01' ? 'var(--accent-tertiary, #FF3DA6)' : 'var(--accent-secondary, #2FE0FF)';
    
    this.wrapper = document.createElement('div');
    this.wrapper.className = 'hud-tv-frame';
    this.wrapper.style.cssText = `
      position: relative;
      border-radius: var(--border-radius-lg, 24px);
      background: var(--bg-deep, #000);
      padding: 16px;
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
      overflow: hidden;
      --tv-glow-color: ${this.glowColor};
      --tv-border-color: var(--border-color, #1F1F1F);
      box-shadow: 0 0 20px 4px rgba(0,0,0,0.5), inset 0 0 0 1px var(--tv-border-color);
    `;

    // Top bar of the TV
    const topBar = document.createElement('div');
    topBar.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px dashed var(--border-color, rgba(255,255,255,0.1));
      z-index: 2;
    `;

    // Status pill
    const statusPill = document.createElement('div');
    statusPill.className = 'hud-status-pill';
    statusPill.style.border = 'none';
    statusPill.style.padding = '0';
    statusPill.style.backgroundColor = 'transparent';
    statusPill.innerHTML = `
      <span class="hud-status-dot ${title === 'CAMERA_01' ? 'magenta' : 'cyan'}" style="background-color: ${this.glowColor}"></span>
      <span style="font-size: 10px; font-weight: bold; color: var(--text-secondary);">${title.toUpperCase()}</span>
    `;

    // "Antenna" / Corner accent SVG
    const accent = document.createElement('div');
    accent.innerHTML = `
      <svg width="24" height="12" viewBox="0 0 24 12" fill="none" stroke="var(--text-muted)" stroke-width="1.5">
        <path d="M2,10 L10,2 L22,2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
    
    topBar.appendChild(statusPill);
    topBar.appendChild(accent);

    const contentWrapper = document.createElement('div');
    contentWrapper.style.cssText = `
      flex: 1;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--bg-primary, #0A0A0A);
      border-radius: var(--border-radius-md, 12px);
      overflow: hidden;
      min-height: 0;
    `;
    
    // Ensure the content element fills its container
    contentEl.style.width = '100%';
    contentEl.style.height = '100%';
    
    contentWrapper.appendChild(contentEl);

    // CRT Scanline Overlay
    const crtOverlay = document.createElement('div');
    crtOverlay.style.cssText = `
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      pointer-events: none;
      z-index: 10;
      background: repeating-linear-gradient(
        0deg,
        transparent,
        transparent 2px,
        rgba(0, 0, 0, 0.1) 2px,
        rgba(0, 0, 0, 0.1) 4px
      );
    `;

    // Glass Reflection
    const glassOverlay = document.createElement('div');
    glassOverlay.style.cssText = `
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      pointer-events: none;
      z-index: 11;
      background: linear-gradient(
        135deg,
        rgba(255, 255, 255, 0.05) 0%,
        rgba(255, 255, 255, 0) 40%,
        rgba(255, 255, 255, 0) 100%
      );
    `;

    contentWrapper.appendChild(crtOverlay);
    contentWrapper.appendChild(glassOverlay);

    this.wrapper.appendChild(topBar);
    this.wrapper.appendChild(contentWrapper);
    
    this.container.appendChild(this.wrapper);
  }

  public setLive(isLive: boolean) {
    if (isLive) {
      this.wrapper.classList.add('live-glow-pulse');
    } else {
      this.wrapper.classList.remove('live-glow-pulse');
    }
  }
}

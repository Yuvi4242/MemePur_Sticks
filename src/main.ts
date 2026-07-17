import './styles/tokens.css';
import './styles/base.css';

console.log('Meme Verse 2.0 // Terminal HUD Initialized');

// DOM bootstrapping placeholder
const app = document.querySelector<HTMLDivElement>('#app');
if (app) {
  app.innerHTML = `
    <header style="height: var(--header-height); border-bottom: 1px solid var(--border-color); display: flex; align-items: center; justify-content: space-between; padding: 0 20px;">
      <h1 class="hud-logo" style="color: var(--accent-primary);">MEME VERSE 2.0</h1>
      <div class="hud-bracket-badge active">NIGHT MODE [ON]</div>
    </header>
    <main style="display: flex; height: calc(100vh - var(--header-height));">
      <aside style="width: var(--sidebar-width); border-right: 1px solid var(--border-color); background-color: var(--bg-deep); padding: 20px;">
        <h2 style="font-size: 12px; color: var(--text-secondary); margin-bottom: 20px;">Gesture Triggers</h2>
        <div class="hud-sidebar-row active">
          <span>SMILE</span>
          <span class="action-value">PULSE</span>
        </div>
        <div class="hud-sidebar-row">
          <span>PEACE</span>
          <span class="action-value">WIGGLE</span>
        </div>
      </aside>
      <section style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px; background-color: var(--bg-primary);">
        <div class="hud-rec-indicator">REC :: TARGET_STAY_STILL</div>
        <div class="hud-bounding-box-container" style="width: 400px; height: 300px; margin-top: 20px;">
          <div class="hud-bounding-box-label">GESTURE: SMILE_0.98</div>
        </div>
        <div class="hud-bottom-toolbar" style="width: 100%; max-width: 500px; margin-top: 25px;">
          <div class="hud-slider-container" style="flex: 1;">
            <span class="hud-slider-label">CONFIDENCE</span>
            <input type="range" class="hud-slider" min="0" max="100" value="75" />
          </div>
        </div>
      </section>
    </main>
  `;
}

export class IntroSequenceComponent {
  private container: HTMLDivElement;
  
  constructor() {
    this.container = document.createElement('div');
    this.container.className = 'intro-sequence-overlay';
    
    // Quick check for reduced motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    
    if (prefersReducedMotion) {
      // Skip intro entirely
      return;
    }
    
    this.container.innerHTML = `
      <div class="intro-content">
        <h1 class="hud-logo intro-logo">MEMEPUR_STICKS</h1>
        <div class="intro-tagline">REACT. MATCH. STICK.</div>
      </div>
    `;
    
    document.body.appendChild(this.container);
    
    // Auto-remove after animation completes (1.6s)
    setTimeout(() => {
      this.container.classList.add('intro-fade-out');
      setTimeout(() => {
        if (this.container.parentNode) {
          this.container.parentNode.removeChild(this.container);
        }
      }, 300); // Wait for fade out
    }, 1500);
  }
}

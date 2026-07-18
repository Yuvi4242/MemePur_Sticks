import { StatsStore, BADGE_DEFINITIONS } from '../../state/stats-store';

export class SidebarComponent {
  constructor(private container: HTMLElement) {}

  render(): void {
    const stats = StatsStore.getStats();
    this.container.innerHTML = '';
    
    // Flex container for badges
    const grid = document.createElement('div');
    grid.style.display = 'flex';
    grid.style.flexWrap = 'wrap';
    grid.style.gap = '12px';
    
    BADGE_DEFINITIONS.forEach(badgeDef => {
      const isUnlocked = stats.unlockedBadges.includes(badgeDef.id);
      
      const badgeWrap = document.createElement('div');
      badgeWrap.style.position = 'relative';
      badgeWrap.style.width = '64px';
      badgeWrap.style.height = '64px';
      badgeWrap.style.flexShrink = '0';
      badgeWrap.style.backgroundColor = isUnlocked ? 'var(--bg-deep)' : 'var(--bg-primary)';
      badgeWrap.style.border = `1px solid ${isUnlocked ? 'var(--accent-tertiary, #FF3DA6)' : 'var(--border-color)'}`;
      badgeWrap.style.borderRadius = 'var(--border-radius-md, 12px)';
      badgeWrap.style.display = 'flex';
      badgeWrap.style.alignItems = 'center';
      badgeWrap.style.justifyContent = 'center';
      badgeWrap.style.cursor = 'help';
      badgeWrap.style.transition = 'all 0.2s';
      
      // Icon
      const icon = document.createElement('div');
      icon.style.width = '32px';
      icon.style.height = '32px';
      icon.style.color = isUnlocked ? 'var(--accent-tertiary, #FF3DA6)' : 'var(--text-muted)';
      icon.style.opacity = isUnlocked ? '1' : '0.3';
      icon.innerHTML = badgeDef.getIconSVG();
      badgeWrap.appendChild(icon);
      
      // Lock overlay if locked
      if (!isUnlocked) {
        const lock = document.createElement('div');
        lock.style.position = 'absolute';
        lock.style.bottom = '4px';
        lock.style.right = '4px';
        lock.style.width = '12px';
        lock.style.height = '12px';
        lock.style.color = 'var(--text-secondary)';
        lock.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`;
        badgeWrap.appendChild(lock);
      }
      
      // Tooltip logic
      const tooltip = document.createElement('div');
      tooltip.className = 'hud-status-pill';
      tooltip.style.position = 'absolute';
      tooltip.style.bottom = '110%';
      tooltip.style.left = '50%';
      tooltip.style.transform = 'translateX(-50%)';
      tooltip.style.zIndex = '20';
      tooltip.style.opacity = '0';
      tooltip.style.pointerEvents = 'none';
      tooltip.style.whiteSpace = 'nowrap';
      tooltip.style.transition = 'opacity 0.2s';
      tooltip.style.flexDirection = 'column';
      tooltip.style.alignItems = 'center';
      tooltip.style.gap = '4px';
      
      const titleSpan = document.createElement('span');
      titleSpan.style.color = 'var(--accent-primary)';
      titleSpan.style.fontWeight = 'bold';
      titleSpan.innerText = badgeDef.displayName;
      
      const descSpan = document.createElement('span');
      descSpan.style.color = 'var(--text-primary)';
      descSpan.style.fontSize = '9px';
      descSpan.innerText = badgeDef.description;
      
      tooltip.appendChild(titleSpan);
      tooltip.appendChild(descSpan);
      badgeWrap.appendChild(tooltip);
      
      badgeWrap.addEventListener('mouseenter', () => tooltip.style.opacity = '1');
      badgeWrap.addEventListener('mouseleave', () => tooltip.style.opacity = '0');
      
      grid.appendChild(badgeWrap);
    });
    
    this.container.appendChild(grid);
  }
}

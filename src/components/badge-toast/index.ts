import { BadgeDef } from '../../state/stats-store';

let queue: BadgeDef[] = [];
let isShowing = false;

export function showBadgeUnlock(badge: BadgeDef): void {
  queue.push(badge);
  if (!isShowing) {
    processQueue();
  }
}

export function showMultipleBadgeUnlocks(badges: BadgeDef[]): void {
  if (badges.length === 0) return;
  queue.push(...badges);
  if (!isShowing) {
    processQueue();
  }
}

function processQueue(): void {
  if (queue.length === 0) {
    isShowing = false;
    return;
  }

  isShowing = true;
  const badge = queue.shift()!;
  
  const toast = document.createElement('div');
  toast.className = 'hud-status-pill';
  toast.style.position = 'fixed';
  toast.style.top = '80px';
  toast.style.left = '50%';
  toast.style.transform = 'translateX(-50%)';
  toast.style.zIndex = '9999';
  toast.style.pointerEvents = 'none';
  toast.style.backgroundColor = 'var(--bg-deep)';
  toast.style.border = '1px solid var(--accent-primary)';
  toast.style.boxShadow = '0 0 15px rgba(0, 229, 255, 0.2)';
  toast.style.padding = '12px 24px';
  toast.style.display = 'flex';
  toast.style.alignItems = 'center';
  toast.style.gap = '12px';
  toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
  toast.style.opacity = '0';
  toast.style.transform = 'translate(-50%, -20px)';
  
  const iconWrap = document.createElement('div');
  iconWrap.style.width = '24px';
  iconWrap.style.height = '24px';
  iconWrap.style.color = 'var(--accent-primary)';
  iconWrap.innerHTML = badge.getIconSVG();
  
  const textWrap = document.createElement('div');
  textWrap.style.display = 'flex';
  textWrap.style.flexDirection = 'column';
  
  const title = document.createElement('span');
  title.style.fontWeight = '800';
  title.style.color = 'var(--accent-primary)';
  title.style.fontSize = '10px';
  title.style.letterSpacing = '0.05em';
  title.innerText = '[ACHIEVEMENT UNLOCKED]';
  
  const name = document.createElement('span');
  name.style.fontSize = '14px';
  name.style.fontWeight = 'bold';
  name.style.color = 'var(--text-primary)';
  name.innerText = badge.displayName;
  
  textWrap.appendChild(title);
  textWrap.appendChild(name);
  
  toast.appendChild(iconWrap);
  toast.appendChild(textWrap);

  document.body.appendChild(toast);

  // Fade in
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translate(-50%, 0)';
  });

  // Auto dismiss
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translate(-50%, -20px)';
    
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
      processQueue();
    }, 300);
  }, 3500);
}

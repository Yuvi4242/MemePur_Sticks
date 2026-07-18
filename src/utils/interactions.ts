export function applyMagneticHover(element: HTMLElement) {
  // Only apply on desktop / pointer devices
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  element.addEventListener('mousemove', (e) => {
    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    // Calculate distance from center
    const deltaX = e.clientX - centerX;
    const deltaY = e.clientY - centerY;
    
    // Max movement is 8px
    const moveX = (deltaX / rect.width) * 16; 
    const moveY = (deltaY / rect.height) * 16;
    
    element.style.transform = `translate(${moveX}px, ${moveY}px)`;
  });

  element.addEventListener('mouseleave', () => {
    element.style.transform = 'translate(0px, 0px)';
  });
}

export function applyRippleEffect(element: HTMLElement) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  element.addEventListener('mousedown', (e) => {
    const rect = element.getBoundingClientRect();
    
    const ripple = document.createElement('span');
    ripple.className = 'interaction-ripple';
    
    const size = Math.max(rect.width, rect.height);
    ripple.style.width = ripple.style.height = `${size}px`;
    
    // Center ripple on click
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;
    
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;
    
    element.appendChild(ripple);
    
    // Remove after animation (500ms)
    setTimeout(() => {
      if (ripple.parentNode) {
        ripple.parentNode.removeChild(ripple);
      }
    }, 500);
  });
}

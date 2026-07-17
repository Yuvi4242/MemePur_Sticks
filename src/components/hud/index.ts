export interface HUDData {
  gesture: { label: string; confidence: number; landmarks: any[] | null } | null;
  expression: { label: string; confidence: number; landmarks: any[] | null } | null;
  combo: string | null;
  allHands?: any[][]; // Optional extra hands landmarks to draw secondary boxes
}

export class HUDComponent {
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  /**
   * Clears all bounding boxes and labels.
   */
  public clear(): void {
    this.container.innerHTML = '';
  }

  /**
   * Renders bounding boxes and label badges onto the camera preview overlay.
   */
  public update(data: HUDData): void {
    // Clear previous frame overlays
    this.clear();

    const rect = this.container.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    if (width === 0 || height === 0) return;

    // 1. Draw Combo label if active
    if (data.combo) {
      // If combo is active, we display a high-contrast centered badge or top badge
      const comboBadge = document.createElement('div');
      comboBadge.className = 'hud-bounding-box-label';
      comboBadge.style.position = 'absolute';
      comboBadge.style.top = '16px';
      comboBadge.style.left = '50%';
      comboBadge.style.transform = 'translateX(-50%)';
      comboBadge.style.backgroundColor = 'var(--accent-primary)';
      comboBadge.style.color = 'var(--bg-deep)';
      comboBadge.style.fontWeight = 'bold';
      comboBadge.style.zIndex = '20';
      comboBadge.innerText = `COMBO: ${data.combo}`;
      this.container.appendChild(comboBadge);
    }

    // 2. Draw Face Bounding Box & Label
    if (data.expression && data.expression.landmarks) {
      const box = this.calculateBoundingBox(data.expression.landmarks);
      if (box) {
        this.renderBox(
          box,
          width,
          height,
          `EXPRESSION: ${data.expression.label.toUpperCase()}_${data.expression.confidence.toFixed(2)}`,
          'var(--accent-secondary)' // Face is Cyan
        );
      }
    }

    // 3. Draw Primary Hand Bounding Box & Label
    if (data.gesture && data.gesture.landmarks) {
      const box = this.calculateBoundingBox(data.gesture.landmarks);
      if (box) {
        this.renderBox(
          box,
          width,
          height,
          `GESTURE: ${data.gesture.label.toUpperCase()}_${data.gesture.confidence.toFixed(2)}`,
          'var(--accent-primary)' // Gesture is Lime-Yellow
        );
      }
    }

    // 4. Draw Secondary (unlabeled) Hand Bounding Boxes if present
    if (data.allHands && data.allHands.length > 1) {
      data.allHands.forEach((handLandmarks, index) => {
        // Skip the primary hand which is index 0 in sorted list
        if (index === 0) return;
        const box = this.calculateBoundingBox(handLandmarks);
        if (box) {
          this.renderBox(
            box,
            width,
            height,
            '', // No label for secondary hands
            'var(--text-muted)' // Muted Gray
          );
        }
      });
    }
  }

  /**
   * Helper to calculate relative bounding box (0 to 1) from Normalized landmarks.
   */
  private calculateBoundingBox(landmarks: any[]): { xmin: number; ymin: number; xmax: number; ymax: number } | null {
    if (!landmarks || landmarks.length === 0) return null;

    let xmin = 1.0;
    let xmax = 0.0;
    let ymin = 1.0;
    let ymax = 0.0;

    landmarks.forEach((pt) => {
      if (pt.x < xmin) xmin = pt.x;
      if (pt.x > xmax) xmax = pt.x;
      if (pt.y < ymin) ymin = pt.y;
      if (pt.y > ymax) ymax = pt.y;
    });

    // Add some padding (10%) to the bounding box
    const paddingX = (xmax - xmin) * 0.1;
    const paddingY = (ymax - ymin) * 0.1;

    return {
      xmin: Math.max(0, xmin - paddingX),
      ymin: Math.max(0, ymin - paddingY),
      xmax: Math.min(1, xmax + paddingX),
      ymax: Math.min(1, ymax + paddingY)
    };
  }

  /**
   * Draws a bounding box element with mirrored position conversion and an optional label.
   */
  private renderBox(
    box: { xmin: number; ymin: number; xmax: number; ymax: number },
    containerWidth: number,
    containerHeight: number,
    labelText: string,
    borderColor: string
  ): void {
    // Mirror conversion: Because canvas pixels are mirrored, a normalized coordinate x
    // maps horizontally to (1 - x).
    // Left boundary = (1 - xmax) * width
    // Width = (xmax - xmin) * width
    const left = (1 - box.xmax) * containerWidth;
    const boxWidth = (box.xmax - box.xmin) * containerWidth;
    const top = box.ymin * containerHeight;
    const boxHeight = (box.ymax - box.ymin) * containerHeight;

    const boxEl = document.createElement('div');
    boxEl.className = 'hud-bounding-box-container';
    boxEl.style.position = 'absolute';
    boxEl.style.left = `${left}px`;
    boxEl.style.top = `${top}px`;
    boxEl.style.width = `${boxWidth}px`;
    boxEl.style.height = `${boxHeight}px`;
    boxEl.style.borderColor = borderColor;
    boxEl.style.pointerEvents = 'none';

    if (labelText) {
      const labelEl = document.createElement('div');
      labelEl.className = 'hud-bounding-box-label';
      labelEl.style.backgroundColor = borderColor;
      // Change color for contrast if border is white or cyan
      labelEl.style.color = borderColor === 'var(--accent-primary)' ? 'var(--bg-deep)' : 'var(--text-primary)';
      labelEl.innerText = labelText;
      boxEl.appendChild(labelEl);
    }

    this.container.appendChild(boxEl);
  }
}

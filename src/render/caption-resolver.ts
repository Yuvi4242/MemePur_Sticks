import { CaptureMetadata } from '../components/camera';

export interface ResolvedStickerMeta {
  captionText: string;
  animationType: string;
}

/**
 * Resolves the caption text and animation type from captured metadata and configuration mappings.
 */
export function resolveCaptionAndAnimation(
  metadata: CaptureMetadata | null,
  mappings: any
): ResolvedStickerMeta {
  const defaultFallback = mappings.no_detection || {
    captionTemplate: 'MOOD: UNKNOWN',
    animationType: 'PULSE'
  };

  if (!metadata) {
    return {
      captionText: defaultFallback.captionTemplate,
      animationType: defaultFallback.animationType
    };
  }

  // 1. Combo check: takes precedence
  if (metadata.isCombo && metadata.comboLabel) {
    const parts = metadata.comboLabel.split('+');
    const gestureId = parts[0]?.toLowerCase();
    const expressionId = parts[1]?.toLowerCase();

    const combo = mappings.combos?.find(
      (c: any) =>
        c.gesture.toLowerCase() === gestureId &&
        c.expression.toLowerCase() === expressionId
    );
    if (combo) {
      return {
        captionText: combo.captionTemplate || combo.caption || 'COMBO ACTIVE',
        animationType: combo.animationType || combo.animation || 'WIGGLE'
      };
    }
  }

  // 2. Gesture check
  if (metadata.gestureLabel) {
    const gesture = mappings.gestures?.find((g: any) => g.id === metadata.gestureLabel);
    if (gesture) {
      return {
        captionText: gesture.captionTemplate || gesture.caption || 'GESTURE ACTIVE',
        animationType: gesture.animationType || gesture.animation || 'PULSE'
      };
    }
  }

  // 3. Expression check
  if (metadata.expressionLabel) {
    const expression = mappings.expressions?.find((e: any) => e.id === metadata.expressionLabel);
    if (expression) {
      return {
        captionText: expression.captionTemplate || expression.caption || 'EXPRESSION ACTIVE',
        animationType: expression.animationType || expression.animation || 'PULSE'
      };
    }
  }

  // 4. Default fallback (when metadata exists but contains no active detections)
  return {
    captionText: defaultFallback.captionTemplate,
    animationType: defaultFallback.animationType
  };
}

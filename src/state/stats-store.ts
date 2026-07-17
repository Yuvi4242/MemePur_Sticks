export interface StatsData {
  totalGestures: number;
  totalExpressions: number;
  totalCombos: number;
  streak: number;
  mostUsedGesture: string;
  mostUsedExpression: string;
  labelCounts: Record<string, number>;
}

export class StatsStore {
  private static readonly KEYS = {
    TOTAL_GESTURES: 'mv_total_gestures',
    TOTAL_EXPRESSIONS: 'mv_total_expressions',
    TOTAL_COMBOS: 'mv_total_combos',
    STREAK: 'mv_streak',
    LAST_VISIT: 'mv_last_visit',
    LABEL_COUNTS: 'mv_label_counts'
  };

  /**
   * Initializes or updates the daily streak based on calendar days.
   */
  public static updateStreak(): number {
    const todayStr = this.getLocalDateString(new Date());
    const lastVisitStr = localStorage.getItem(this.KEYS.LAST_VISIT);
    let streak = parseInt(localStorage.getItem(this.KEYS.STREAK) || '0', 10);

    if (!lastVisitStr) {
      // First visit ever
      streak = 1;
      localStorage.setItem(this.KEYS.LAST_VISIT, todayStr);
      localStorage.setItem(this.KEYS.STREAK, '1');
    } else {
      if (lastVisitStr === todayStr) {
        // Already visited today, streak stays the same
      } else {
        const lastVisitDate = new Date(lastVisitStr);
        const todayDate = new Date(todayStr);
        const diffTime = todayDate.getTime() - lastVisitDate.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
          // Visited yesterday, increment streak
          streak += 1;
          localStorage.setItem(this.KEYS.STREAK, streak.toString());
        } else if (diffDays > 1) {
          // Skipped a day or more, reset streak
          streak = 1;
          localStorage.setItem(this.KEYS.STREAK, '1');
        }
        localStorage.setItem(this.KEYS.LAST_VISIT, todayStr);
      }
    }
    return streak;
  }

  /**
   * Increments the count of a specific gesture.
   */
  public static recordGesture(label: string): void {
    // Increment total gestures
    const total = parseInt(localStorage.getItem(this.KEYS.TOTAL_GESTURES) || '0', 10);
    localStorage.setItem(this.KEYS.TOTAL_GESTURES, (total + 1).toString());

    this.incrementLabel(label);
  }

  /**
   * Increments the count of a specific expression.
   */
  public static recordExpression(label: string): void {
    // Increment total expressions
    const total = parseInt(localStorage.getItem(this.KEYS.TOTAL_EXPRESSIONS) || '0', 10);
    localStorage.setItem(this.KEYS.TOTAL_EXPRESSIONS, (total + 1).toString());

    this.incrementLabel(label);
  }

  /**
   * Increments the count of a specific combo.
   */
  public static recordCombo(comboLabel: string): void {
    const total = parseInt(localStorage.getItem(this.KEYS.TOTAL_COMBOS) || '0', 10);
    localStorage.setItem(this.KEYS.TOTAL_COMBOS, (total + 1).toString());

    // Record individual elements too, split by '+'
    const parts = comboLabel.split('+');
    parts.forEach((part) => {
      this.incrementLabel(part.toLowerCase());
    });
  }

  /**
   * Returns current statistics compiled from localStorage.
   */
  public static getStats(): StatsData {
    const totalGestures = parseInt(localStorage.getItem(this.KEYS.TOTAL_GESTURES) || '0', 10);
    const totalExpressions = parseInt(localStorage.getItem(this.KEYS.TOTAL_EXPRESSIONS) || '0', 10);
    const totalCombos = parseInt(localStorage.getItem(this.KEYS.TOTAL_COMBOS) || '0', 10);
    const streak = parseInt(localStorage.getItem(this.KEYS.STREAK) || '0', 10);
    const labelCounts = this.getLabelCounts();

    const { mostUsedGesture, mostUsedExpression } = this.computeMostUsed(labelCounts);

    return {
      totalGestures,
      totalExpressions,
      totalCombos,
      streak,
      mostUsedGesture,
      mostUsedExpression,
      labelCounts
    };
  }

  /**
   * Triggers a browser confirmation box and resets stats if confirmed.
   */
  public static resetStats(): boolean {
    const confirmed = confirm('Are you sure you want to reset all your statistics and streak counter?');
    if (confirmed) {
      localStorage.removeItem(this.KEYS.TOTAL_GESTURES);
      localStorage.removeItem(this.KEYS.TOTAL_EXPRESSIONS);
      localStorage.removeItem(this.KEYS.TOTAL_COMBOS);
      localStorage.removeItem(this.KEYS.STREAK);
      localStorage.removeItem(this.KEYS.LAST_VISIT);
      localStorage.removeItem(this.KEYS.LABEL_COUNTS);
      return true;
    }
    return false;
  }

  // --- Private Helpers ---

  private static getLocalDateString(date: Date): string {
    const offset = date.getTimezoneOffset();
    const localDate = new Date(date.getTime() - offset * 60 * 1000);
    return localDate.toISOString().split('T')[0];
  }

  private static getLabelCounts(): Record<string, number> {
    const data = localStorage.getItem(this.KEYS.LABEL_COUNTS);
    if (!data) return {};
    try {
      return JSON.parse(data);
    } catch {
      return {};
    }
  }

  private static incrementLabel(label: string): void {
    const counts = this.getLabelCounts();
    counts[label] = (counts[label] || 0) + 1;
    localStorage.setItem(this.KEYS.LABEL_COUNTS, JSON.stringify(counts));
  }

  private static computeMostUsed(counts: Record<string, number>): { mostUsedGesture: string; mostUsedExpression: string } {
    // List of known gestures and expressions IDs from mapping
    const gestureIds = ['thumbs_up', 'fist', 'ok_sign', 'shh', 'peace', 'rock', 'call_me', 'wave', 'pinch'];
    const expressionIds = ['smile', 'tongue_out', 'angry', 'sad', 'surprised', 'wink'];

    let maxGestureCount = 0;
    let mostUsedGesture = '--';
    let maxExpressionCount = 0;
    let mostUsedExpression = '--';

    Object.entries(counts).forEach(([label, count]) => {
      if (gestureIds.includes(label)) {
        if (count > maxGestureCount) {
          maxGestureCount = count;
          mostUsedGesture = label.toUpperCase().replace('_', ' ');
        }
      } else if (expressionIds.includes(label)) {
        if (count > maxExpressionCount) {
          maxExpressionCount = count;
          mostUsedExpression = label.toUpperCase().replace('_', ' ');
        }
      }
    });

    return { mostUsedGesture, mostUsedExpression };
  }
}

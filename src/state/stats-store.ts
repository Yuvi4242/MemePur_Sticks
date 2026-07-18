export interface StatsData {
  totalGestures: number;
  totalExpressions: number;
  totalCombos: number;
  streak: number;
  mostUsedGesture: string;
  mostUsedExpression: string;
  labelCounts: Record<string, number>;
  totalExportsAllTime: number;
  uniqueCombosTriggered: string[];
  unlockedBadges: string[];
}

export interface BadgeDef {
  id: string;
  displayName: string;
  description: string;
  getIconSVG: () => string;
  unlockCondition: (stats: StatsData) => boolean;
}

export const BADGE_DEFINITIONS: BadgeDef[] = [
  {
    id: 'first_sticker',
    displayName: 'FIRST STICKER',
    description: 'Export your very first sticker.',
    getIconSVG: () => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`,
    unlockCondition: (stats) => stats.totalExportsAllTime >= 1
  },
  {
    id: 'sticker_machine',
    displayName: 'STICKER MACHINE',
    description: 'Export 10 stickers total.',
    getIconSVG: () => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`,
    unlockCondition: (stats) => stats.totalExportsAllTime >= 10
  },
  {
    id: 'combo_master',
    displayName: 'COMBO MASTER',
    description: 'Discover 3 unique gesture + expression combinations.',
    getIconSVG: () => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="12" r="6"></circle><circle cx="16" cy="12" r="6"></circle></svg>`,
    unlockCondition: (stats) => stats.uniqueCombosTriggered.length >= 3
  },
  {
    id: 'week_streak',
    displayName: 'WEEK STREAK',
    description: 'Use Meme Verse 7 days in a row.',
    getIconSVG: () => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path></svg>`,
    unlockCondition: (stats) => stats.streak >= 7
  }
];

export class StatsStore {
  private static readonly KEYS = {
    TOTAL_GESTURES: 'mv_total_gestures',
    TOTAL_EXPRESSIONS: 'mv_total_expressions',
    TOTAL_COMBOS: 'mv_total_combos',
    STREAK: 'mv_streak',
    LAST_VISIT: 'mv_last_visit',
    LABEL_COUNTS: 'mv_label_counts',
    TOTAL_EXPORTS: 'mv_total_exports',
    UNIQUE_COMBOS: 'mv_unique_combos',
    UNLOCKED_BADGES: 'mv_unlocked_badges'
  };

  private static safeGetItem(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private static safeSetItem(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn(`[StatsStore] Failed to save ${key} to localStorage:`, e);
    }
  }

  private static safeRemoveItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      // Ignore
    }
  }

  /**
   * Initializes or updates the daily streak based on calendar days.
   * Returns newly unlocked badges.
   */
  public static updateStreak(): BadgeDef[] {
    const todayStr = this.getLocalDateString(new Date());
    const lastVisitStr = this.safeGetItem(this.KEYS.LAST_VISIT);
    let streak = parseInt(this.safeGetItem(this.KEYS.STREAK) || '0', 10);

    if (!lastVisitStr) {
      streak = 1;
      this.safeSetItem(this.KEYS.LAST_VISIT, todayStr);
      this.safeSetItem(this.KEYS.STREAK, '1');
    } else {
      if (lastVisitStr !== todayStr) {
        const lastVisitDate = new Date(lastVisitStr);
        const todayDate = new Date(todayStr);
        const diffTime = todayDate.getTime() - lastVisitDate.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
          streak += 1;
          this.safeSetItem(this.KEYS.STREAK, streak.toString());
        } else if (diffDays > 1) {
          streak = 1;
          this.safeSetItem(this.KEYS.STREAK, '1');
        }
        this.safeSetItem(this.KEYS.LAST_VISIT, todayStr);
      }
    }
    return this.checkBadges();
  }

  public static recordGesture(label: string): BadgeDef[] {
    const total = parseInt(this.safeGetItem(this.KEYS.TOTAL_GESTURES) || '0', 10);
    this.safeSetItem(this.KEYS.TOTAL_GESTURES, (total + 1).toString());
    this.incrementLabel(label);
    return this.checkBadges();
  }

  public static recordExpression(label: string): BadgeDef[] {
    const total = parseInt(this.safeGetItem(this.KEYS.TOTAL_EXPRESSIONS) || '0', 10);
    this.safeSetItem(this.KEYS.TOTAL_EXPRESSIONS, (total + 1).toString());
    this.incrementLabel(label);
    return this.checkBadges();
  }

  public static recordCombo(comboLabel: string): BadgeDef[] {
    const total = parseInt(this.safeGetItem(this.KEYS.TOTAL_COMBOS) || '0', 10);
    this.safeSetItem(this.KEYS.TOTAL_COMBOS, (total + 1).toString());

    const parts = comboLabel.split('+');
    parts.forEach((part) => this.incrementLabel(part.toLowerCase()));

    // Track unique combos
    const unique = this.getJsonArray(this.KEYS.UNIQUE_COMBOS);
    if (!unique.includes(comboLabel)) {
      unique.push(comboLabel);
      this.safeSetItem(this.KEYS.UNIQUE_COMBOS, JSON.stringify(unique));
    }

    return this.checkBadges();
  }

  public static recordExport(): BadgeDef[] {
    const total = parseInt(this.safeGetItem(this.KEYS.TOTAL_EXPORTS) || '0', 10);
    this.safeSetItem(this.KEYS.TOTAL_EXPORTS, (total + 1).toString());
    return this.checkBadges();
  }

  public static getStats(): StatsData {
    const totalGestures = parseInt(this.safeGetItem(this.KEYS.TOTAL_GESTURES) || '0', 10);
    const totalExpressions = parseInt(this.safeGetItem(this.KEYS.TOTAL_EXPRESSIONS) || '0', 10);
    const totalCombos = parseInt(this.safeGetItem(this.KEYS.TOTAL_COMBOS) || '0', 10);
    const streak = parseInt(this.safeGetItem(this.KEYS.STREAK) || '0', 10);
    const labelCounts = this.getLabelCounts();
    const { mostUsedGesture, mostUsedExpression } = this.computeMostUsed(labelCounts);
    
    const totalExportsAllTime = parseInt(this.safeGetItem(this.KEYS.TOTAL_EXPORTS) || '0', 10);
    const uniqueCombosTriggered = this.getJsonArray(this.KEYS.UNIQUE_COMBOS);
    const unlockedBadges = this.getJsonArray(this.KEYS.UNLOCKED_BADGES);

    return {
      totalGestures,
      totalExpressions,
      totalCombos,
      streak,
      mostUsedGesture,
      mostUsedExpression,
      labelCounts,
      totalExportsAllTime,
      uniqueCombosTriggered,
      unlockedBadges
    };
  }

  public static resetStats(): boolean {
    const confirmed = confirm('Are you sure you want to reset all your statistics, streaks, and badges?');
    if (confirmed) {
      this.safeRemoveItem(this.KEYS.TOTAL_GESTURES);
      this.safeRemoveItem(this.KEYS.TOTAL_EXPRESSIONS);
      this.safeRemoveItem(this.KEYS.TOTAL_COMBOS);
      this.safeRemoveItem(this.KEYS.STREAK);
      this.safeRemoveItem(this.KEYS.LAST_VISIT);
      this.safeRemoveItem(this.KEYS.LABEL_COUNTS);
      this.safeRemoveItem(this.KEYS.TOTAL_EXPORTS);
      this.safeRemoveItem(this.KEYS.UNIQUE_COMBOS);
      this.safeRemoveItem(this.KEYS.UNLOCKED_BADGES);
      return true;
    }
    return false;
  }

  private static checkBadges(): BadgeDef[] {
    const stats = this.getStats();
    const newlyUnlocked: BadgeDef[] = [];
    const unlockedList = [...stats.unlockedBadges];

    for (const def of BADGE_DEFINITIONS) {
      if (!unlockedList.includes(def.id) && def.unlockCondition(stats)) {
        unlockedList.push(def.id);
        newlyUnlocked.push(def);
      }
    }

    if (newlyUnlocked.length > 0) {
      this.safeSetItem(this.KEYS.UNLOCKED_BADGES, JSON.stringify(unlockedList));
    }
    return newlyUnlocked;
  }

  private static getJsonArray(key: string): string[] {
    const data = this.safeGetItem(key);
    if (!data) return [];
    try {
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private static getLocalDateString(date: Date): string {
    const offset = date.getTimezoneOffset();
    const localDate = new Date(date.getTime() - offset * 60 * 1000);
    return localDate.toISOString().split('T')[0];
  }

  private static getLabelCounts(): Record<string, number> {
    const data = this.safeGetItem(this.KEYS.LABEL_COUNTS);
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
    this.safeSetItem(this.KEYS.LABEL_COUNTS, JSON.stringify(counts));
  }

  private static computeMostUsed(counts: Record<string, number>): { mostUsedGesture: string; mostUsedExpression: string } {
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

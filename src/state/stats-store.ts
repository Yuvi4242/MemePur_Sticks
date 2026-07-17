// Stats store placeholder: handles localStorage-backed stats/streaks/achievements tracking.
export class StatsStore {
  static getStats() {
    return {
      totalStickers: 0,
      streak: 0,
      mostUsedGesture: '',
      mostUsedExpression: ''
    };
  }
}

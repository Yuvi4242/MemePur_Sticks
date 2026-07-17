// Settings store placeholder: handles UI state, sensitivity, and dark/light theme preference.
export class SettingsStore {
  static getSettings() {
    return {
      confidenceThreshold: 0.75,
      theme: 'dark'
    };
  }
}

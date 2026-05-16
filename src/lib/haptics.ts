
/**
 * Triggers a subtle haptic feedback using the Vibration API.
 * 
 * Pattern details:
 * - subtle: brief 10ms tap
 * - medium: 30ms tap
 * - warning: two short pulses
 * - success: one medium pulse
 */
export const hapticFeedback = (
  type: 'subtle' | 'medium' | 'warning' | 'success' = 'subtle',
  enabled: boolean = true
) => {
  if (!enabled || typeof window === 'undefined' || !window.navigator.vibrate) return;

  try {
    switch (type) {
      case 'subtle':
        window.navigator.vibrate(10);
        break;
      case 'medium':
        window.navigator.vibrate(30);
        break;
      case 'warning':
        window.navigator.vibrate([40, 60, 40]);
        break;
      case 'success':
        window.navigator.vibrate(60);
        break;
      default:
        window.navigator.vibrate(10);
    }
  } catch (err) {
    // Silently fail if vibrate is blocked by security policy/iframe
    console.warn('Haptic feedback failed:', err);
  }
};

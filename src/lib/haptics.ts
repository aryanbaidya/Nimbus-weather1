
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
  type: 'subtle' | 'medium' | 'warning' | 'success' | 'error' = 'subtle',
  enabled: boolean = true
) => {
  if (!enabled || typeof window === 'undefined' || !window.navigator.vibrate) {
    if (!enabled) return;
    // Attempting a fallback for environments that might have restricted vibrate
    return;
  }

  try {
    // Log to console to help verify it is firing in environments with restricted physical haptics
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[Haptics] Triggering ${type}`);
    }
    
    switch (type) {
      case 'subtle':
        window.navigator.vibrate(12);
        break;
      case 'medium':
        window.navigator.vibrate(35);
        break;
      case 'warning':
        // Two short pulses as requested (40ms pulse, 60ms gap, 40ms pulse)
        window.navigator.vibrate([45, 65, 45]);
        break;
      case 'success':
        window.navigator.vibrate(70);
        break;
      case 'error':
        // Stronger warning for errors (100ms)
        window.navigator.vibrate([100, 50, 100]);
        break;
      default:
        window.navigator.vibrate(15);
    }
  } catch (err) {
    console.warn('Haptic feedback attempted but failed:', err);
  }
};

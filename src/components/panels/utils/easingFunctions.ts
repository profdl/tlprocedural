/**
 * Enhanced easing functions for haptic-like feedback in panel interactions
 */

export type EasingFunction = (t: number) => number

/**
 * Collection of easing functions that provide natural, haptic-like feedback
 */
export const Easing = {
  // Basic easing functions
  linear: (t: number) => t,

  // Quadratic easing - smooth acceleration/deceleration
  easeInQuad: (t: number) => t * t,
  easeOutQuad: (t: number) => t * (2 - t),
  easeInOutQuad: (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,

  // Cubic easing - more dramatic curves
  easeInCubic: (t: number) => t * t * t,
  easeOutCubic: (t: number) => (--t) * t * t + 1,
  easeInOutCubic: (t: number) => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,

  // Quartic easing - even more dramatic
  easeInQuart: (t: number) => t * t * t * t,
  easeOutQuart: (t: number) => 1 - (--t) * t * t * t,
  easeInOutQuart: (t: number) => t < 0.5 ? 8 * t * t * t * t : 1 - 8 * (--t) * t * t * t,

  // Elastic easing - bouncy feedback (great for snapping)
  easeOutElastic: (t: number) => {
    if (t === 0) return 0
    if (t === 1) return 1
    const p = 0.3
    const a = 1
    const s = p / 4
    return a * Math.pow(2, -10 * t) * Math.sin((t - s) * (2 * Math.PI) / p) + 1
  },

  easeInOutElastic: (t: number) => {
    if (t === 0) return 0
    if (t === 1) return 1
    const p = 0.3 * 1.5
    const a = 1
    const s = p / 4
    t *= 2
    if (t < 1) {
      return -0.5 * (a * Math.pow(2, 10 * (t -= 1)) * Math.sin((t - s) * (2 * Math.PI) / p))
    }
    return a * Math.pow(2, -10 * (t -= 1)) * Math.sin((t - s) * (2 * Math.PI) / p) * 0.5 + 1
  },

  // Back easing - overshoot and return (great for magnetic attraction)
  easeOutBack: (t: number) => {
    const c1 = 1.70158
    const c3 = c1 + 1
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
  },

  easeInBack: (t: number) => {
    const c1 = 1.70158
    const c3 = c1 + 1
    return c3 * t * t * t - c1 * t * t
  },

  // Bounce easing - multiple bounces (good for collision feedback)
  easeOutBounce: (t: number) => {
    const n1 = 7.5625
    const d1 = 2.75

    if (t < 1 / d1) {
      return n1 * t * t
    } else if (t < 2 / d1) {
      return n1 * (t -= 1.5 / d1) * t + 0.75
    } else if (t < 2.5 / d1) {
      return n1 * (t -= 2.25 / d1) * t + 0.9375
    } else {
      return n1 * (t -= 2.625 / d1) * t + 0.984375
    }
  },

  // Spring easing - physics-based spring animation
  spring: (t: number, tension = 300, friction = 10) => {
    const w = Math.sqrt(tension) / friction
    const z = friction / (2 * Math.sqrt(tension))

    if (z < 1) {
      // Under-damped
      const wd = w * Math.sqrt(1 - z * z)
      return 1 - Math.exp(-z * w * t) * Math.cos(wd * t)
    } else {
      // Critically or over-damped
      return 1 - Math.exp(-w * t)
    }
  },

  // Custom magnetic attraction easing
  magneticAttraction: (t: number) => {
    // Creates a strong pull that eases off as it approaches the target
    return 1 - Math.pow(1 - t, 3) * (1 + 2 * Math.sin(t * Math.PI))
  },

  // Haptic feedback curve - mimics physical interaction
  haptic: (t: number) => {
    // Combines ease-out with subtle bounce for tactile feel
    if (t < 0.8) {
      return Easing.easeOutCubic(t / 0.8) * 0.95
    } else {
      const bounceT = (t - 0.8) / 0.2
      return 0.95 + 0.05 * Math.sin(bounceT * Math.PI * 2) * (1 - bounceT)
    }
  }
}

/**
 * Interpolate between two values using an easing function
 */
export function interpolate(
  start: number,
  end: number,
  progress: number,
  easingFn: EasingFunction = Easing.linear
): number {
  return start + (end - start) * easingFn(progress)
}

/**
 * Interpolate between two positions using an easing function
 */
export function interpolatePosition(
  start: { x: number; y: number },
  end: { x: number; y: number },
  progress: number,
  easingFn: EasingFunction = Easing.linear
): { x: number; y: number } {
  return {
    x: interpolate(start.x, end.x, progress, easingFn),
    y: interpolate(start.y, end.y, progress, easingFn)
  }
}

/**
 * Create a CSS cubic-bezier string from an easing function
 */
export function createCubicBezier(easingFn: EasingFunction): string {
  // Approximate common easing functions as cubic-bezier
  if (easingFn === Easing.easeOutQuart) {
    return 'cubic-bezier(0.165, 0.84, 0.44, 1)'
  }
  if (easingFn === Easing.easeOutBack) {
    return 'cubic-bezier(0.175, 0.885, 0.32, 1.275)'
  }
  if (easingFn === Easing.spring) {
    return 'cubic-bezier(0.68, -0.55, 0.265, 1.55)'
  }
  if (easingFn === Easing.haptic) {
    return 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
  }

  // Default to ease-out
  return 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
}

/**
 * Calculate magnetic strength with haptic feedback curve
 */
export function calculateMagneticStrength(distance: number, threshold: number): number {
  if (distance >= threshold) return 0

  const normalizedDistance = 1 - (distance / threshold)
  return Easing.magneticAttraction(normalizedDistance)
}

/**
 * Calculate bounce intensity based on velocity and surface properties
 */
export function calculateBounce(velocity: number, dampening = 0.7): number {
  return Math.min(Math.abs(velocity) * dampening, 1)
}
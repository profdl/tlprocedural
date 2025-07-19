/**
 * Debug logging utility
 */
export function logShapeOperation(
  operation: string,
  shapeId: string,
  details: Record<string, unknown>
): void {
  // In a browser environment, we can check if we're in development mode
  // by looking for a global variable or using a different approach
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    console.log(`[${operation}] Shape ${shapeId}:`, details)
  }
} 
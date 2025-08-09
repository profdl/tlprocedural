import { useGeneratorEngine } from './hooks/useGeneratorEngine'

/**
 * Component that must be rendered inside Tldraw context to access useEditor
 */
export function GeneratorEngine() {
  useGeneratorEngine()
  return null
}

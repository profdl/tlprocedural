import type { 
  ShapeState, 
  ShapeInstance, 
  Transform,
  ModifierProcessor,
  LSystemSettings
} from '../../../types/modifiers'

// Simple L-system turtle interpreter that generates shape clones along the turtle path.
// Interprets: F = forward and clone, f = forward no clone, + = turn left, - = turn right, [ = push, ] = pop.
export const LSystemProcessor: ModifierProcessor = {
  process(input: ShapeState, settings: LSystemSettings): ShapeState {
    const { iterations, angle, stepPercent } = settings
    const angleRad = (angle * Math.PI) / 180
    const scalePerIteration = settings.scalePerIteration ?? 1.0

    const newInstances: ShapeInstance[] = []
    newInstances.push(...input.instances)

    function addCloneAt(centerX: number, centerY: number, heading: number, source: ShapeInstance, depth: number, level: number) {
      const shapeWidth = 'w' in source.shape.props ? (source.shape.props.w as number) : 100
      const shapeHeight = 'h' in source.shape.props ? (source.shape.props.h as number) : 100
      const scaleFactor = Math.pow(scalePerIteration, level)
      
      // tldraw rotations assume 0 rad is along +X. Most shapes are designed upright at 0 rad.
      // Align the visual center to the turtle position and rotate with a +90° offset so that
      // a heading of -90° (up) yields 0° shape rotation (upright).
      const rotation = heading + Math.PI / 2
      const cos = Math.cos(rotation)
      const sin = Math.sin(rotation)
      
      // Simple approach: center the shape at the turtle position with proper rotation handling
      // Use original dimensions for consistent positioning regardless of scale
      const centerOffsetX = (shapeWidth / 2) * (cos - 1) - (shapeHeight / 2) * sin
      const centerOffsetY = (shapeWidth / 2) * sin + (shapeHeight / 2) * (cos - 1)
      const topLeftX = centerX - shapeWidth / 2 - centerOffsetX
      const topLeftY = centerY - shapeHeight / 2 - centerOffsetY
      
      const newTransform: Transform = {
        x: topLeftX,
        y: topLeftY,
        rotation,
        scaleX: source.transform.scaleX * scaleFactor,
        scaleY: source.transform.scaleY * scaleFactor
      }
      newInstances.push({
        shape: { ...source.shape },
        transform: newTransform,
        index: newInstances.length,
        metadata: { ...source.metadata, lsystem: true, lsystemDepth: depth }
      })
    }

    function branch(x: number, y: number, heading: number, depth: number, length: number, level: number, source: ShapeInstance) {
      if (depth === 0) return
      const nx = x + Math.cos(heading) * length
      const ny = y + Math.sin(heading) * length
      addCloneAt(nx, ny, heading, source, depth, level)
      const nextLen = length * Math.pow(scalePerIteration, level)
      const nextDepth = depth - 1
      const nextLevel = level + 1
      // Determine branch angles
      const baseAngles = (settings.branches && settings.branches.length > 0)
        ? settings.branches.map(a => (a * Math.PI) / 180)
        : [-angleRad, angleRad]
      const rngSeed = (settings.seed ?? 1) + nextLevel * 997
      let rnd = rngSeed
      const rand = () => {
        // simple LCG
        rnd = (rnd * 1664525 + 1013904223) % 4294967296
        return rnd / 4294967296
      }
      const angleJitter = (settings.angleJitter ?? 0) * (Math.PI / 180)
      const prob = settings.branchProbability ?? 1
      baseAngles.forEach(rel => {
        if (rand() <= prob) {
          const jitterAng = angleJitter ? (rand() * 2 - 1) * angleJitter : 0
          branch(nx, ny, heading + rel + jitterAng, nextDepth, nextLen, nextLevel, source)
        }
      })
    }

    // Run for each starting instance
    input.instances.forEach((inst) => {
      const shapeWidth = 'w' in inst.shape.props ? (inst.shape.props.w as number) : 100
      const shapeHeight = 'h' in inst.shape.props ? (inst.shape.props.h as number) : 100
      const cx = inst.transform.x + shapeWidth / 2
      const cy = inst.transform.y + shapeHeight / 2
      const heading = inst.transform.rotation || -Math.PI / 2
      const baseSize = Math.max(shapeWidth, shapeHeight)
      const baseStep = baseSize * ((stepPercent ?? 100) / 100)
      branch(cx, cy, heading, Math.max(0, iterations), baseStep, 0, inst)
    })

    
    return { ...input, instances: newInstances }
  }
}

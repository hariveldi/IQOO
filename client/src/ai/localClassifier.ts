import { pipeline, env } from '@xenova/transformers'

// Configure Transformers.js for in-browser client execution
if (typeof window !== 'undefined') {
  env.allowLocalModels = false
  env.useBrowserCache = true
}

export type LocalModelStatus = 'unloaded' | 'loading' | 'ready' | 'fallback'

export interface LocalClassificationResult {
  actionable: boolean
  confidence: number
  latencyMs: number
  method: 'on-device-onnx-embedding' | 'fallback-passthrough'
  reason: string
  modelName: string
}

let modelStatus: LocalModelStatus = 'unloaded'
let extractorPromise: Promise<any> | null = null
let extractorInstance: any = null
let actEmbeddings: number[][] = []
let nonEmbeddings: number[][] = []

const statusListeners = new Set<(status: LocalModelStatus) => void>()

function setStatus(status: LocalModelStatus) {
  modelStatus = status
  statusListeners.forEach((fn) => {
    try {
      fn(status)
    } catch {
      // ignore
    }
  })
}

export function getLocalModelStatus(): LocalModelStatus {
  return modelStatus
}

export function onModelStatusChange(listener: (status: LocalModelStatus) => void): () => void {
  statusListeners.add(listener)
  return () => {
    statusListeners.delete(listener)
  }
}

// Canonical prototype anchors for semantic similarity comparison
const ACTIONABLE_PROTOTYPES = [
  'Submit the project report by tomorrow at 5 PM',
  'I will send Rahul the report tomorrow',
  'I will meet Rahul tomorrow at 3 PM',
  'I will prepare the presentation on my laptop tonight',
  'Schedule a sync meeting with engineering team on Friday',
  'Pay the electricity and vendor bill before the due date',
  'Create a high priority task to fix the database bug',
  'Remind me to follow up with the client regarding contract proposal',
  'Prepare executive slide deck for quarterly business review',
  'Buy groceries and medicine this evening',
  'Fix the crash on Android client login page',
  'Send project status update email to stakeholders',
  'Review the pull request and merge into main branch',
]

const NON_ACTIONABLE_PROTOTYPES = [
  'Hey how are you doing today',
  'The weather is very nice outside today',
  'Rahul sent the report yesterday',
  'Maybe we should work on the presentation someday',
  'I agree with what you said earlier',
  'Thanks so much see you later bye',
  'Yeah that sounds interesting tell me more',
  'Just chilling and having a coffee with friends',
  'What do you think about the movie',
  'Haha that was a funny story',
  'Good morning everyone welcome to the call',
  'Okay let me think about that for a second',
]

// Compute dot product of two normalized vectors (cosine similarity)
function dotProduct(a: number[], b: number[]): number {
  let sum = 0
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i]
  }
  return sum
}

// Extract normalized embedding vector
async function extractEmbedding(extractor: any, text: string): Promise<number[]> {
  const output = await extractor(text, { pooling: 'mean', normalize: true })
  return Array.from(output.data)
}

/**
 * Initializes the on-device ML model in browser memory/WASM lazily.
 */
export async function initLocalClassifier(): Promise<boolean> {
  if (modelStatus === 'ready' && extractorInstance) {
    return true
  }

  if (extractorPromise) {
    try {
      await extractorPromise
      return modelStatus === 'ready'
    } catch {
      return false
    }
  }

  setStatus('loading')

  extractorPromise = (async () => {
    try {
      console.info('[On-Device AI] Loading Xenova/all-MiniLM-L6-v2 ONNX model via Transformers.js WASM...')
      const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
        quantized: true,
      })

      // Pre-compute normalized embeddings for prototype anchors
      actEmbeddings = await Promise.all(
        ACTIONABLE_PROTOTYPES.map((p) => extractEmbedding(extractor, p))
      )
      nonEmbeddings = await Promise.all(
        NON_ACTIONABLE_PROTOTYPES.map((p) => extractEmbedding(extractor, p))
      )

      extractorInstance = extractor
      setStatus('ready')
      console.info('[On-Device AI] Model ready for local inference (384-d WASM ONNX embeddings).')
      return true
    } catch (err) {
      console.warn('[On-Device AI] Local model load notice, falling back to passthrough:', err)
      setStatus('fallback')
      return false
    } finally {
      extractorPromise = null
    }
  })()

  return extractorPromise
}

/**
 * Classifies an incoming speech segment locally on-device BEFORE reaching Gemini.
 * If local model is unavailable or encounters an error, gracefully passes through to Gemini.
 */
export async function classifyConversationSegment(text: string): Promise<LocalClassificationResult> {
  const trimmed = text.trim()
  if (!trimmed) {
    return {
      actionable: false,
      confidence: 0,
      latencyMs: 0,
      method: 'on-device-onnx-embedding',
      reason: 'Empty text',
      modelName: 'Xenova/all-MiniLM-L6-v2',
    }
  }

  // If local model is not initialized yet, attempt init
  if (modelStatus === 'unloaded') {
    initLocalClassifier().catch(() => {})
  }

  // Graceful fallback if model is still loading or failed
  if (modelStatus !== 'ready' || !extractorInstance) {
    return {
      actionable: true,
      confidence: 1.0,
      latencyMs: 0,
      method: 'fallback-passthrough',
      reason: `Local model in ${modelStatus} state; passthrough to Gemini enabled`,
      modelName: 'passthrough-fallback',
    }
  }

  const tStart = performance.now()
  try {
    const vec = await extractEmbedding(extractorInstance, trimmed)

    let maxAct = -1
    for (const a of actEmbeddings) {
      const s = dotProduct(vec, a)
      if (s > maxAct) maxAct = s
    }

    let maxNon = -1
    for (const n of nonEmbeddings) {
      const s = dotProduct(vec, n)
      if (s > maxNon) maxNon = s
    }

    // Softmax temperature scaling
    const tau = 0.1
    const expAct = Math.exp(maxAct / tau)
    const expNon = Math.exp(maxNon / tau)
    const confidence = expAct / (expAct + expNon)
    const latencyMs = Math.round(performance.now() - tStart)

    // Conservative threshold: confidence >= 0.55
    const actionable = confidence >= 0.55

    return {
      actionable,
      confidence: parseFloat(confidence.toFixed(4)),
      latencyMs,
      method: 'on-device-onnx-embedding',
      reason: actionable
        ? `Actionable intent detected (maxAct: ${maxAct.toFixed(3)} vs maxNon: ${maxNon.toFixed(3)})`
        : `Non-actionable conversational noise filtered locally (maxNon: ${maxNon.toFixed(3)})`,
      modelName: 'Xenova/all-MiniLM-L6-v2',
    }
  } catch (err: any) {
    console.warn('[On-Device AI] Inference error, falling back to Gemini:', err)
    return {
      actionable: true,
      confidence: 1.0,
      latencyMs: Math.round(performance.now() - tStart),
      method: 'fallback-passthrough',
      reason: `Inference error: ${err.message || 'Unknown'}; fallback to Gemini`,
      modelName: 'passthrough-fallback',
    }
  }
}
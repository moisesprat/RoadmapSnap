import pixelmatch from 'pixelmatch'
import { PNG } from 'pngjs'

/** D-08: at most 0.1% of pixels may differ between two renders. */
export const MAX_DIFF_RATIO = 0.001

export interface CompareResult {
  width: number
  height: number
  diffPixels: number
  ratio: number
  diffPng: Buffer
}

/**
 * Compares two PNG buffers with pixelmatch (threshold 0.1).
 * Throws a descriptive error when the dimensions differ (pixelmatch would throw anyway).
 */
export function comparePngs(a: Buffer, b: Buffer): CompareResult {
  const imgA = PNG.sync.read(a)
  const imgB = PNG.sync.read(b)
  if (imgA.width !== imgB.width || imgA.height !== imgB.height) {
    throw new Error(
      `Screenshot dimensions differ: ${imgA.width}x${imgA.height} vs ${imgB.width}x${imgB.height}`,
    )
  }
  const { width, height } = imgA
  const diff = new PNG({ width, height })
  const diffPixels = pixelmatch(imgA.data, imgB.data, diff.data, width, height, { threshold: 0.1 })
  return { width, height, diffPixels, ratio: diffPixels / (width * height), diffPng: PNG.sync.write(diff) }
}

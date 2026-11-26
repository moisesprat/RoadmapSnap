// Download helpers for the Lite exports: a text file from a Blob and a file from a data URL.

function clickDownload(href: string, filename: string): void {
  const link = document.createElement('a')
  link.href = href
  link.download = filename
  link.click()
}

/** Downloads `content` as `filename`, the way Lite's downloadFile does. */
export function downloadText(content: string, filename: string, mimeType: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }))
  clickDownload(url, filename)
  URL.revokeObjectURL(url)
}

/** Downloads the data URL (a canvas capture) as `filename`. */
export function downloadDataUrl(url: string, filename: string): void {
  clickDownload(url, filename)
}

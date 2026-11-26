// Deterministic layout for jsdom, which has no layout engine: Element.prototype.getBoundingClientRect becomes a
// function of the element's row index and class. Rows are 40px apart starting at y=100 (plus `rowTop` offset),
// the track starts at x=260 and is 740px wide, and the container sits at (10, 20). Shared by the Lite arrow
// characterization (02-11) and the React arrow comparison (02-13) so both measure the same rectangles.

export interface RectMockLayout {
  /** Top of the first row; change it to simulate a layout change (for example a window resize). */
  firstRowTop: number
}

export function installRectMock(layout: RectMockLayout = { firstRowTop: 100 }): RectMockLayout {
  const rect = (left: number, top: number, width: number, height: number) => ({
    left, top, width, height, right: left + width, bottom: top + height, x: left, y: top,
    toJSON() { return this },
  })
  const rowIndexOf = (el: Element) => {
    const row = el.closest('.data-source-row')
    return row ? Array.from(document.querySelectorAll('.data-source-row')).indexOf(row) : -1
  }
  Element.prototype.getBoundingClientRect = function (this: Element) {
    if (this.classList.contains('roadmap-content')) return rect(10, 20, 1000, 900) as DOMRect
    if (this.classList.contains('data-source-row')) return rect(10, layout.firstRowTop + rowIndexOf(this) * 40, 1000, 36) as DOMRect
    if (this.classList.contains('timeline-track')) return rect(260, layout.firstRowTop + rowIndexOf(this) * 40, 740, 36) as DOMRect
    return rect(0, 0, 0, 0) as DOMRect
  }
  return layout
}

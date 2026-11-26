// Canonical serializer for golden-markup comparisons (D-01): the React render of a core model must equal Lite's
// own renderer for the same model. Differences that do not change the tag tree, classes, text or presentation
// attributes are ignored on purpose: event handler attributes, role, tabindex, aria-* and data-* (the SaaS render
// adds accessibility attributes Lite does not have), the order of classes and attributes, and whitespace that
// CSS would collapse anyway (indentation between block elements, leading and trailing space in a block).

const BLOCK_TAGS = new Set([
  'div', 'p', 'ul', 'ol', 'li', 'select', 'option', 'optgroup', 'footer', 'header', 'section', 'main', 'nav',
  'table', 'thead', 'tbody', 'tr', 'td', 'th', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'form', 'fieldset', 'br',
])

// Properties that reflect the live state, compared through the DOM property so that markup (`selected`,
// `value="…"` attributes in Lite) and framework-managed state (React sets the property) look the same.
const PROPERTY_ATTRIBUTES = new Set(['selected', 'value'])

function isDroppedAttribute(name: string): boolean {
  return (
    name.startsWith('on') ||
    name === 'role' ||
    name === 'tabindex' ||
    name.startsWith('aria-') ||
    name.startsWith('data-')
  )
}

function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeAttribute(value: string): string {
  return escapeText(value).replace(/"/g, '&quot;')
}

// `prop: value` pairs sorted by property, from the attribute text itself (jsdom's CSSStyleDeclaration drops
// properties it does not know, which would hide differences).
function normalizeStyle(value: string): string {
  return value
    .split(';')
    .map((declaration) => declaration.trim())
    .filter(Boolean)
    .map((declaration) => {
      const at = declaration.indexOf(':')
      const property = declaration.slice(0, at).trim().toLowerCase()
      const val = declaration.slice(at + 1).trim().replace(/\s+/g, ' ')
      return property + ': ' + val
    })
    .sort()
    .join('; ')
}

function isBlock(node: Node | undefined): boolean {
  if (!node) return true
  return node.nodeType === 1 && BLOCK_TAGS.has((node as Element).localName.toLowerCase())
}

function serializeAttributes(el: Element): string {
  const tag = el.localName.toLowerCase()
  const out: [string, string][] = []
  for (const attr of Array.from(el.attributes)) {
    const name = attr.name.toLowerCase()
    if (isDroppedAttribute(name) || PROPERTY_ATTRIBUTES.has(name)) continue
    if (name === 'class') {
      const classes = attr.value.split(/\s+/).filter(Boolean).sort()
      if (classes.length) out.push(['class', classes.join(' ')])
    } else if (name === 'style') {
      const style = normalizeStyle(attr.value)
      if (style) out.push(['style', style])
    } else {
      out.push([name, attr.value])
    }
  }
  if (tag === 'option') {
    out.push(['value', (el as HTMLOptionElement).value])
    if ((el as HTMLOptionElement).selected) out.push(['selected', ''])
  } else if (tag === 'input') {
    out.push(['value', (el as HTMLInputElement).value])
  }
  out.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
  return out.map(([name, value]) => ' ' + name + '="' + escapeAttribute(value) + '"').join('')
}

function serializeChildren(parent: Node): string {
  // Merge adjacent text nodes first: React splits `a {b} c` into three nodes, an HTML parser makes one.
  const nodes: Node[] = []
  let pendingText: string | null = null
  const flush = () => {
    if (pendingText !== null) nodes.push(document.createTextNode(pendingText))
    pendingText = null
  }
  for (const child of Array.from(parent.childNodes)) {
    if (child.nodeType === 3) {
      pendingText = (pendingText ?? '') + (child.nodeValue ?? '')
    } else if (child.nodeType === 1) {
      flush()
      nodes.push(child)
    }
  }
  flush()

  let out = ''
  nodes.forEach((node, index) => {
    if (node.nodeType === 1) {
      out += serializeElement(node as Element)
      return
    }
    let text = (node.nodeValue ?? '').replace(/\s+/g, ' ')
    // CSS drops a space at the edge of a block and next to a block sibling.
    if (isBlock(nodes[index - 1])) text = text.replace(/^ /, '')
    if (isBlock(nodes[index + 1])) text = text.replace(/ $/, '')
    if (text) out += escapeText(text)
  })
  return out
}

function serializeElement(el: Element): string {
  const tag = el.localName.toLowerCase()
  return '<' + tag + serializeAttributes(el) + '>' + serializeChildren(el) + '</' + tag + '>'
}

/** Serializes an element and everything below it into a canonical string. */
export function normalizeMarkup(root: Element): string {
  return serializeElement(root)
}

/** Parses an HTML string (Lite's renderer output) in a detached container and serializes its content. */
export function normalizeHtmlString(markup: string): string {
  const container = document.createElement('div')
  container.innerHTML = markup
  return serializeChildren(container)
}

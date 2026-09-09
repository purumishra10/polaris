function parseInline(text) {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return escaped
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<span class="md-link">$1</span>')
}

function isTableRow(line) {
  return line.trim().startsWith('|') && line.trim().endsWith('|')
}

function isTableDivider(line) {
  return /^\s*\|?\s*:?-{3,}/.test(line)
}

function splitRow(line) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim())
}

function parseTable(lines, start) {
  const header = splitRow(lines[start])
  let index = start + 1
  if (lines[index] && isTableDivider(lines[index])) index += 1
  const rows = []
  while (index < lines.length && isTableRow(lines[index]) && !isTableDivider(lines[index])) {
    rows.push(splitRow(lines[index]))
    index += 1
  }
  return { header, rows, end: index }
}

export function parseMarkdown(md) {
  const lines = String(md ?? '').replace(/\r\n/g, '\n').split('\n')
  const sections = []
  let current = { title: 'Overview', level: 1, blocks: [] }
  let buffer = []

  const flushParagraph = () => {
    const text = buffer.join(' ').trim()
    if (text) current.blocks.push({ type: 'p', text })
    buffer = []
  }

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    const heading = line.match(/^(#{1,3})\s+(.*)$/)
    if (heading) {
      flushParagraph()
      sections.push(current)
      current = {
        title: heading[2].replace(/\*\*/g, '').trim(),
        level: heading[1].length,
        blocks: [],
      }
      continue
    }

    if (line.trim().startsWith('```')) {
      flushParagraph()
      const code = []
      i += 1
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        code.push(lines[i])
        i += 1
      }
      current.blocks.push({ type: 'code', text: code.join('\n') })
      continue
    }

    if (isTableRow(line) && lines[i + 1] && isTableDivider(lines[i + 1])) {
      flushParagraph()
      const table = parseTable(lines, i)
      current.blocks.push({ type: 'table', header: table.header, rows: table.rows })
      i = table.end - 1
      continue
    }

    if (/^\s*[-*]\s+/.test(line)) {
      flushParagraph()
      const items = []
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, '').trim())
        i += 1
      }
      i -= 1
      current.blocks.push({ type: 'ul', items })
      continue
    }

    if (!line.trim()) {
      flushParagraph()
      continue
    }

    buffer.push(line.trim())
  }

  flushParagraph()
  sections.push(current)
  return sections.filter(
    (section) => section.blocks.length > 0 && section.title !== 'Dropped (facts already pulled, or irrelevant to the twin)',
  )
}

export function renderInline(text) {
  return parseInline(text)
}

export function sectionsForStation(sections, station) {
  const needles =
    station === 'MAITRI'
      ? ['maitri', 'schirmacher', 'priyadarshini', 'novo']
      : ['bharati', 'larsemann', 'quilty', 'grovnes']
  const shared = ['station identity', 'logistics', 'climate', 'people', 'data', 'dataset']
  return sections.filter((section) => {
    const hay = `${section.title} ${section.blocks
      .map((block) => {
        if (block.type === 'p') return block.text
        if (block.type === 'ul') return block.items.join(' ')
        return ''
      })
      .join(' ')}`.toLowerCase()
    if (shared.some((word) => section.title.toLowerCase().includes(word))) return true
    return needles.some((word) => hay.includes(word))
  })
}

import type { SearchNode } from './searchAst'
import { defaultSearchAst } from './searchAst'
import { formatTagLabel, slugifyTag } from './tagDisplay'

export interface SearchResolveTag {
  id: number
  slug: string
  display_name: string
  disambiguator?: string | null
}

export interface SearchResolveCollection {
  id: number
  name: string
}

export interface SearchResolveRoot {
  id: number
  path: string
}

export interface SearchResolveContext {
  tags: SearchResolveTag[]
  collections: SearchResolveCollection[]
  roots: SearchResolveRoot[]
}

export interface ParseError {
  message: string
  offset: number
}

export interface ParseResult {
  ast: SearchNode
  errors: ParseError[]
}

const KEYWORDS = new Set(['and', 'or', 'not'])

export function parseSearchQuery(text: string, ctx: SearchResolveContext): ParseResult {
  const errors: ParseError[] = []
  const src = text.trim()
  if (!src) {
    return { ast: defaultSearchAst, errors: [] }
  }

  const p = new Parser(src, ctx, errors)
  try {
    const ast = p.parseOr()
    p.skipWs()
    if (p.pos < src.length) {
      errors.push({ message: `Unexpected "${src.slice(p.pos, p.pos + 16)}"`, offset: p.pos })
    }
    return { ast, errors }
  } catch {
    return { ast: defaultSearchAst, errors }
  }
}

class Parser {
  pos = 0

  constructor(
    private readonly src: string,
    private readonly ctx: SearchResolveContext,
    private readonly errors: ParseError[]
  ) {}

  parseOr(): SearchNode {
    let left = this.parseAndChain()
    while (this.matchKeyword('or')) {
      const right = this.parseAndChain()
      left =
        left.type === 'or'
          ? { type: 'or', children: [...left.children, right] }
          : { type: 'or', children: [left, right] }
    }
    return left
  }

  parseAndChain(): SearchNode {
    const nodes = this.parseNotList()
    if (nodes.length === 0) return defaultSearchAst
    if (nodes.length === 1) return nodes[0]!
    return { type: 'and', children: nodes }
  }

  parseNotList(): SearchNode[] {
    const nodes: SearchNode[] = []
    while (true) {
      this.skipWs()
      if (this.pos >= this.src.length) break
      if (this.peekKeyword('or') || this.peekChar(')')) break
      if (this.matchKeyword('and')) continue
      if (this.matchKeyword('not')) {
        const inner = this.parseNotList()
        const child = inner.length === 1 ? inner[0]! : { type: 'and' as const, children: inner }
        nodes.push({ type: 'not', child })
        continue
      }
      nodes.push(this.parsePrimary())
    }
    return nodes
  }

  parsePrimary(): SearchNode {
    this.skipWs()
    if (this.peekChar('(')) {
      this.pos++
      const inner = this.parseOr()
      this.skipWs()
      if (!this.peekChar(')')) {
        this.fail('Expected ")"')
      } else {
        this.pos++
      }
      return inner
    }
    return this.parseClause()
  }

  parseClause(): SearchNode {
    const start = this.pos
    let include = true
    if (this.peekChar('-')) {
      include = false
      this.pos++
    }

    const key = this.readIdent()
    if (!key) this.fail('Expected search clause', start)
    if (KEYWORDS.has(key.toLowerCase())) {
      this.fail(`Unexpected keyword "${key}"`, start)
    }

    if (!this.peekChar(':')) {
      this.fail(`Expected ":" after "${key}"`, start)
    }
    this.pos++

    const value =
      key.toLowerCase() === 'untagged' ? this.readOptionalValue() : this.readValue()
    const subjectGroup = this.readSubjectModifier()

    switch (key.toLowerCase()) {
      case 'tag': {
        const tagId = this.resolveTag(value, start)
        return { type: 'tag', tagId, include, ...(subjectGroup != null ? { subjectGroup } : {}) }
      }
      case 'suggested': {
        const tagId = this.resolveTag(value, start)
        return {
          type: 'suggestedTag',
          tagId,
          include,
          ...(subjectGroup != null ? { subjectGroup } : {})
        }
      }
      case 'collection': {
        if (subjectGroup != null) {
          this.fail('@subject applies to tag/suggested clauses only', this.pos)
        }
        const collectionId = this.resolveCollection(value, start)
        return { type: 'collection', collectionId }
      }
      case 'principal': {
        if (subjectGroup != null) {
          this.fail('@subject applies to tag/suggested clauses only', this.pos)
        }
        const tagId = this.resolveTag(value, start)
        return { type: 'principalTag', tagId }
      }
      case 'folder': {
        if (subjectGroup != null) {
          this.fail('@subject applies to tag/suggested clauses only', this.pos)
        }
        return this.resolveFolder(value)
      }
      case 'wiki': {
        if (subjectGroup != null) {
          this.fail('@subject applies to tag/suggested clauses only', this.pos)
        }
        if (value.toLowerCase() === 'empty') return { type: 'wikiEmpty' }
        return { type: 'wiki', query: value }
      }
      case 'untagged': {
        if (subjectGroup != null) {
          this.fail('@subject applies to tag/suggested clauses only', this.pos)
        }
        return { type: 'untagged' }
      }
      case 'name': {
        if (subjectGroup != null) {
          this.fail('@subject applies to tag/suggested clauses only', this.pos)
        }
        const mode = value.includes('*') || value.includes('?') ? 'glob' : 'substring'
        return { type: 'path', pattern: value, mode }
      }
      case 'kind': {
        if (subjectGroup != null) {
          this.fail('@subject applies to tag/suggested clauses only', this.pos)
        }
        return { type: 'kind', kind: value }
      }
      default:
        this.fail(`Unknown clause "${key}:"`, start)
    }
  }

  readSubjectModifier(): number | null {
    this.skipWs()
    if (!this.peekChar('@')) return null
    const at = this.pos
    this.pos++
    const word = this.readIdent()
    if (word?.toLowerCase() !== 'subject') {
      this.fail('Expected @subject', at)
    }
    let group = 1
    if (this.peekChar(':')) {
      this.pos++
      const num = this.readNumber()
      if (num == null || num < 1) {
        this.fail('Expected scope number after @subject:', this.pos)
      }
      group = num
    }
    return group
  }

  readNumber(): number | null {
    let n = 0
    let found = false
    while (this.pos < this.src.length) {
      const c = this.src[this.pos]!
      if (c < '0' || c > '9') break
      found = true
      n = n * 10 + (c.charCodeAt(0) - 48)
      this.pos++
    }
    return found ? n : null
  }

  readValue(): string {
    this.skipWs()
    if (this.peekChar('"')) {
      return this.readQuoted()
    }
    return this.readBareValue()
  }

  readOptionalValue(): string {
    this.skipWs()
    if (this.pos >= this.src.length) return ''
    if (this.peekChar('"')) return this.readQuoted()
    const c = this.src[this.pos]!
    if (/\s/.test(c) || c === ')' || c === '(') return ''
    if (c === '@' && this.src.slice(this.pos).toLowerCase().startsWith('@subject')) return ''
    return this.readBareValue()
  }

  readQuoted(): string {
    this.pos++
    let out = ''
    while (this.pos < this.src.length) {
      const c = this.src[this.pos]!
      if (c === '"') {
        this.pos++
        return out
      }
      if (c === '\\' && this.pos + 1 < this.src.length) {
        this.pos++
        out += this.src[this.pos]!
        this.pos++
        continue
      }
      out += c
      this.pos++
    }
    this.fail('Unclosed quote')
  }

  readBareValue(): string {
    const start = this.pos
    while (this.pos < this.src.length) {
      const c = this.src[this.pos]!
      if (/\s/.test(c) || c === ')' || c === '(') break
      if (c === '@' && this.src.slice(this.pos).toLowerCase().startsWith('@subject')) {
        break
      }
      this.pos++
    }
    const v = this.src.slice(start, this.pos)
    if (!v) this.fail('Expected value after ":"', start)
    return v
  }

  readIdent(): string | null {
    this.skipWs()
    const start = this.pos
    if (this.pos >= this.src.length) return null
    const first = this.src[this.pos]!
    if (!/[a-zA-Z_]/.test(first)) return null
    this.pos++
    while (this.pos < this.src.length) {
      const c = this.src[this.pos]!
      if (!/[a-zA-Z0-9_-]/.test(c)) break
      this.pos++
    }
    return this.src.slice(start, this.pos)
  }

  resolveTag(value: string, offset: number): number {
    const trimmed = value.trim()
    const bySlug = this.ctx.tags.filter((t) => t.slug === trimmed)
    if (bySlug.length === 1) return bySlug[0]!.id
    if (bySlug.length > 1) {
      this.fail(`Ambiguous tag slug "${trimmed}"`, offset)
    }

    const labelMatch = trimmed.match(/^(.+?)\s*\(([^)]+)\)\s*$/)
    if (labelMatch) {
      const name = labelMatch[1]!.trim()
      const dis = labelMatch[2]!.trim()
      const hits = this.ctx.tags.filter(
        (t) =>
          t.display_name.toLowerCase() === name.toLowerCase() &&
          (t.disambiguator ?? '').toLowerCase() === dis.toLowerCase()
      )
      if (hits.length === 1) return hits[0]!.id
      if (hits.length > 1) this.fail(`Ambiguous tag "${trimmed}"`, offset)
    }

    const byName = this.ctx.tags.filter(
      (t) => t.display_name.toLowerCase() === trimmed.toLowerCase() && !t.disambiguator
    )
    if (byName.length === 1) return byName[0]!.id

    const bySlugified = this.ctx.tags.filter(
      (t) => slugifyTag(t.display_name, t.disambiguator) === trimmed
    )
    if (bySlugified.length === 1) return bySlugified[0]!.id

    const fuzzy = this.ctx.tags.filter(
      (t) =>
        formatTagLabel({
          display_name: t.display_name,
          disambiguator: t.disambiguator ?? null
        }).toLowerCase() === trimmed.toLowerCase()
    )
    if (fuzzy.length === 1) return fuzzy[0]!.id
    if (fuzzy.length > 1) this.fail(`Ambiguous tag "${trimmed}"`, offset)

    this.fail(`Unknown tag "${trimmed}"`, offset)
  }

  resolveCollection(value: string, offset: number): number {
    const name = value.trim()
    const hits = this.ctx.collections.filter((c) => c.name.toLowerCase() === name.toLowerCase())
    if (hits.length === 1) return hits[0]!.id
    if (hits.length > 1) this.fail(`Ambiguous collection "${name}"`, offset)
    this.fail(`Unknown collection "${name}"`, offset)
  }

  resolveFolder(value: string): SearchNode {
    const norm = value.replace(/\\/g, '/').replace(/\/+$/, '')
    let best: SearchResolveRoot | null = null
    for (const r of this.ctx.roots) {
      const rp = r.path.replace(/\\/g, '/').replace(/\/+$/, '')
      if (norm === rp || norm.startsWith(rp + '/')) {
        if (!best || rp.length > best.path.length) best = r
      }
    }
    if (!best) {
      this.fail(`No watch folder matches "${value}"`, this.pos)
    }
    return { type: 'folder', rootId: best!.id, pathPrefix: norm }
  }

  matchKeyword(kw: string): boolean {
    this.skipWs()
    const saved = this.pos
    const id = this.readIdent()
    if (id?.toLowerCase() === kw) return true
    this.pos = saved
    return false
  }

  peekKeyword(kw: string): boolean {
    const saved = this.pos
    this.skipWs()
    const id = this.readIdent()
    this.pos = saved
    return id?.toLowerCase() === kw
  }

  peekChar(c: string): boolean {
    this.skipWs()
    return this.src[this.pos] === c
  }

  skipWs(): void {
    while (this.pos < this.src.length && /\s/.test(this.src[this.pos]!)) this.pos++
  }

  fail(message: string, offset?: number): never {
    this.errors.push({ message, offset: offset ?? this.pos })
    throw new Error(message)
  }
}

export function formatSearchQuery(ast: SearchNode, ctx?: SearchResolveContext): string {
  switch (ast.type) {
    case 'and':
      return ast.children.map((c) => formatSearchQuery(c, ctx)).join(' ')
    case 'or':
      return ast.children.map((c) => `(${formatSearchQuery(c, ctx)})`).join(' OR ')
    case 'not':
      return `NOT ${formatSearchQuery(ast.child, ctx)}`
    case 'tag': {
      const slug = ctx ? tagSlug(ast.tagId, ctx) : String(ast.tagId)
      const mod = subjectMod(ast.subjectGroup)
      return `${ast.include ? '' : '-'}tag:${slug}${mod}`
    }
    case 'suggestedTag': {
      const slug = ctx ? tagSlug(ast.tagId, ctx) : String(ast.tagId)
      const mod = subjectMod(ast.subjectGroup)
      return `${ast.include ? '' : '-'}suggested:${slug}${mod}`
    }
    case 'collection': {
      const name = ctx?.collections.find((c) => c.id === ast.collectionId)?.name ?? String(ast.collectionId)
      return `collection:"${name.replace(/"/g, '\\"')}"`
    }
    case 'principalTag': {
      const slug = ctx ? tagSlug(ast.tagId, ctx) : String(ast.tagId)
      return `principal:${slug}`
    }
    case 'folder':
      return `folder:"${(ast.pathPrefix ?? '').replace(/"/g, '\\"')}"`
    case 'wiki':
      return `wiki:"${ast.query.replace(/"/g, '\\"')}"`
    case 'wikiEmpty':
      return 'wiki:empty'
    case 'untagged':
      return 'untagged:'
    case 'path':
      return `name:${ast.pattern}`
    case 'kind':
      return `kind:${ast.kind}`
    default:
      return ''
  }
}

function tagSlug(tagId: number, ctx: SearchResolveContext): string {
  return ctx.tags.find((t) => t.id === tagId)?.slug ?? String(tagId)
}

function subjectMod(group?: number): string {
  if (group == null) return ''
  if (group === 1) return '@subject'
  return `@subject:${group}`
}

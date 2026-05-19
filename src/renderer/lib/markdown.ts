import MarkdownIt from 'markdown-it'
import DOMPurify from 'dompurify'

const md = new MarkdownIt({ html: false, linkify: true })

/** Render markdown to sanitized HTML (wiki links use tag:// and collection:// hrefs). */
export function markdownToHtml(source: string): string {
  let text = source
  text = text.replace(/\[\[tag:([^\]]+)\]\]/g, (_m, slug) => `[${slug}](tag://${slug})`)
  text = text.replace(
    /\[\[collection:(\d+)\]\]/g,
    (_m, id) => `[Collection ${id}](collection://${id})`
  )
  return DOMPurify.sanitize(md.render(text), { ADD_ATTR: ['target'] })
}

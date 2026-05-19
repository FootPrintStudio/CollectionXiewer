import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export function loadSchema(): string {
  try {
    return readFileSync(join(__dirname, 'schema.sql'), 'utf-8')
  } catch {
    return readFileSync(join(process.cwd(), 'src/main/db/schema.sql'), 'utf-8')
  }
}

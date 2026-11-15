import { spawn, execFile } from 'node:child_process'
import { accessSync, constants, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { shell } from 'electron'

function isExecutable(path: string): boolean {
  try {
    accessSync(path, constants.X_OK)
    return true
  } catch {
    return false
  }
}

/** Resolve an Obsidian binary/AppImage without launching it. */
export function resolveObsidianBinary(): string | null {
  const home = homedir()
  const candidates = [
    process.env.OBSIDIAN_PATH,
    join(home, '.local', 'bin', 'obsidian'),
    '/usr/bin/obsidian',
    '/usr/local/bin/obsidian',
    join(home, 'Desktop', 'Obsidian.AppImage'),
    join(home, 'Applications', 'Obsidian.AppImage')
  ].filter((p): p is string => !!p && p.trim().length > 0)

  for (const p of candidates) {
    if (isExecutable(p)) return p
  }

  // Desktop AppImage with version suffix (Obsidian-1.12.4.AppImage)
  try {
    const desktop = join(home, 'Desktop')
    for (const name of readdirSync(desktop)) {
      if (/^Obsidian.*\.AppImage$/i.test(name)) {
        const full = join(desktop, name)
        if (isExecutable(full)) return full
      }
    }
  } catch {
    /* ignore */
  }

  return null
}

function whichObsidian(): Promise<string | null> {
  return new Promise((resolve) => {
    execFile('command', ['-v', 'obsidian'], { shell: '/bin/bash', timeout: 2000 }, (err, stdout) => {
      if (err) {
        resolve(null)
        return
      }
      const path = stdout.trim()
      resolve(path && isExecutable(path) ? path : null)
    })
  })
}

function spawnDetached(bin: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const child = spawn(bin, args, {
        detached: true,
        stdio: 'ignore',
        env: process.env
      })
      child.on('error', reject)
      child.unref()
      // Don't wait for exit — Obsidian stays running.
      resolve()
    } catch (err) {
      reject(err)
    }
  })
}

/**
 * Open http(s) via Electron shell; open obsidian:// by invoking the Obsidian
 * binary when the desktop has no x-scheme-handler (common with AppImage installs).
 */
export async function openExternalUrl(url: string): Promise<void> {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error('Invalid URL')
  }

  if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
    await shell.openExternal(parsed.toString())
    return
  }

  if (parsed.protocol !== 'obsidian:') {
    throw new Error('Only http(s) and obsidian:// URLs can be opened')
  }

  // Prefer the original string — avoid WHATWG re-serialization surprises.
  const href = url.trim()
  const bin = resolveObsidianBinary() ?? (await whichObsidian())

  if (bin) {
    try {
      await spawnDetached(bin, [href])
      return
    } catch (err) {
      console.warn(
        '[openExternal] Obsidian spawn failed, falling back to shell.openExternal:',
        err instanceof Error ? err.message : err
      )
    }
  }

  try {
    await shell.openExternal(href)
  } catch (err) {
    const hint = bin
      ? ''
      : ' No Obsidian binary found (tried ~/.local/bin/obsidian and Desktop AppImage). Set OBSIDIAN_PATH or install a desktop handler for obsidian://.'
    throw new Error(
      `Could not open Obsidian URI.${hint} ${err instanceof Error ? err.message : String(err)}`
    )
  }
}

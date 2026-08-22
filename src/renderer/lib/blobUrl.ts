/** Convert JPEG base64 from IPC into a revocable blob URL. */
export function jpegBase64ToObjectUrl(b64: string): string {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return URL.createObjectURL(new Blob([bytes], { type: 'image/jpeg' }))
}

export function revokeObjectUrl(url: string | null | undefined): void {
  if (url && url.startsWith('blob:')) URL.revokeObjectURL(url)
}

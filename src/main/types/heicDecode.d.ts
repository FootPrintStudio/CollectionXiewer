declare module 'heic-decode' {
  export interface HeicDecodedImage {
    width: number
    height: number
    data: Uint8ClampedArray
  }

  export default function decode(options: { buffer: Buffer }): Promise<HeicDecodedImage>
}

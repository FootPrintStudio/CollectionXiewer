declare module 'bmp-js' {
  export interface BmpDecoded {
    width: number
    height: number
    bitPP?: number
    data: Buffer
  }
  export function decode(buffer: Buffer): BmpDecoded
}

declare module 'tga' {
  export default class TGA {
    constructor(buffer: Buffer, opt?: { dontFixAlpha?: boolean })
    width: number
    height: number
    pixels: Uint8Array
  }
}

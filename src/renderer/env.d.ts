/// <reference types="vite/client" />

import type { CollectionXiewerApi } from '../preload/index'

declare global {
  interface Window {
    collectionXiewer: CollectionXiewerApi
  }
}

export {}

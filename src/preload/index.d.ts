import type { CollectionXiewerApi } from './index'

declare global {
  interface Window {
    collectionXiewer: CollectionXiewerApi
  }
}

export {}

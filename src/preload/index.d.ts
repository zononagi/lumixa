import type { LumixaApi } from './index'

declare global {
  interface Window {
    lumixa: LumixaApi
  }
}

export {}

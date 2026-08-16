export {}

declare global {
  interface Window {
    rmst?: {
      getBookmarks: () => Promise<unknown[]>
    }
  }
}

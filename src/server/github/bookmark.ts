import { bookMarkList } from '@/app/api/bookmark/route'

export async function getBookmarkList() {
  return JSON.stringify(bookMarkList)
}

/** AI 工具名去掉 bookmark_ 前缀后，通过该映射找到具体实现。 */
export const bookmarkToolsMap = {
  getBookmarkList
}

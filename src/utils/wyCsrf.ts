// 网易云 __csrf 内存缓存
// - 供 musicSdk 请求层同步读取（weapi 写请求需要 csrf_token）
// - 持久化（加密存储）由 wySecureToken.ts 管理，此模块零依赖避免循环引用
let cachedCsrf = ''

export const setCachedWyCsrf = (csrf: string) => {
  cachedCsrf = csrf
}

export const getWyCsrf = (): string => cachedCsrf

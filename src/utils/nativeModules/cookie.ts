import { NativeModules } from 'react-native'

const { CookieModule } = NativeModules

// 读取 WebView CookieManager 中指定 url 的 Cookie（含 HttpOnly Cookie）
export const getWebViewCookie = CookieModule.getCookie as (url: string) => Promise<string>

// 强制将 WebView Cookie 落盘持久化
export const flushWebViewCookie = CookieModule.flush as () => Promise<void>

// 退出网易云登录时清理的 Cookie 域名
const NETEASE_COOKIE_URLS = ['https://music.163.com', 'https://y.music.163.com']

// 清除网易云登录 WebView 的 Cookie（仅限 163 域名，不影响其他 Cookie）
export const clearNetEaseCookies = async(): Promise<void> => {
  for (const url of NETEASE_COOKIE_URLS) {
    await CookieModule.removeCookies(url)
  }
}

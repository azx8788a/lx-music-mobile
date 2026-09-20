import { NativeModules } from 'react-native'

const { CookieModule } = NativeModules

// 读取 WebView CookieManager 中指定 url 的 Cookie（含 HttpOnly Cookie）
export const getWebViewCookie = CookieModule.getCookie as (url: string) => Promise<string>

// 强制将 WebView Cookie 落盘持久化
export const flushWebViewCookie = CookieModule.flush as () => Promise<void>

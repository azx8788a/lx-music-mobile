import { useEffect, useRef, useState } from 'react'
import { View, StatusBar } from 'react-native'
import { Navigation } from 'react-native-navigation'
import WebView from 'react-native-webview'
import type { WebViewErrorEvent } from 'react-native-webview/lib/WebViewTypes'

import Button from '@/components/common/Button'
import Text from '@/components/common/Text'
import Loading from '@/components/common/Loading'
import { createStyle, toast } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { updateSetting } from '@/core/common'
import { getLoginStatus } from '@/utils/musicSdk/wy/userPlaylist'
import { getWebViewCookie, flushWebViewCookie } from '@/utils/nativeModules/cookie'
import { saveSnapshot } from '@/core/wySnapshot'
import { saveWyToken } from '@/utils/wySecureToken'
import { log } from '@/utils/log'

// 网易云音乐移动版登录页
const WY_LOGIN_URL = 'https://music.163.com/m/login'
// 登录成功后 Cookie 可能落在任一域名下，逐个检查
const COOKIE_URLS = ['https://music.163.com', 'https://y.music.163.com']
const CHECK_INTERVAL = 1500

// 从 "name=value; name2=value2" 形式的 Cookie 字符串中提取 MUSIC_U
const pickMusicU = (cookie: string) => {
  const matches = cookie.match(/MUSIC_U=[^;\s]+/g) ?? []
  let musicU = ''
  for (const item of matches) {
    const value = item.substring(8)
    if (value) musicU = value
  }
  return musicU
}

// 从 "name=value; name2=value2" 形式的 Cookie 字符串中提取指定名称的值（如 __csrf）
const pickCookieValue = (cookie: string, name: string) => {
  const match = cookie.match(new RegExp(`${name}=([^;\\s]+)`))
  return match ? match[1] : ''
}

const WyLoginModal = ({ componentId }: { componentId: string }) => {
  const theme = useTheme()
  const t = useI18n()
  const [loadError, setLoadError] = useState(false)
  const canceledRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // 已验证为失效的 MUSIC_U，避免对同一个失效 Cookie 重复验证
  const lastInvalidRef = useRef('')
  // 上次读取 Cookie 失败的错误信息，避免重复写相同日志
  const lastReadErrorRef = useRef('')

  const clearTimer = () => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  const handleSuccess = async(musicU: string, csrf: string, userInfo: { uid: string, nickname: string, avatarUrl: string }) => {
    // 将 WebView 中的 Cookie 落盘，下次打开 App 时浏览器内仍是登录状态
    void flushWebViewCookie()
    // 保存登录状态（Token 加密存储，含 __csrf 供写接口使用），下次打开直接使用
    void saveWyToken(musicU, csrf)
    updateSetting({ 'wy.userInfo': JSON.stringify(userInfo) })
    log.info(`[WY 网页登录] 登录成功，uid: ${userInfo.uid || '-'}，nickname: ${userInfo.nickname || '-'}`)
    toast(t('wy_login_success'))
    void Navigation.dismissOverlay(componentId)
    // 登录成功后自动保存全部歌单快照
    toast(t('wy_snapshot_saving'))
    void saveSnapshot(musicU).then(({ playlists, failed }) => {
      toast(t('wy_snapshot_saved', { num: playlists.length - failed }))
    }).catch((err: Error) => {
      log.warn(`[WY 网页登录] 歌单快照保存失败: ${err.message}`)
      toast(t('wy_snapshot_save_failed'))
    })
  }

  // 先验证 Cookie 有效性再保存，避免保存残留的失效登录状态
  const trySaveCookie = async(musicU: string, csrf: string): Promise<boolean> => {
    log.info(`[WY 网页登录] 检测到 MUSIC_U（长度: ${musicU.length}），验证登录态...`)
    try {
      const profile = await getLoginStatus(musicU)
      if (canceledRef.current) return true
      await handleSuccess(musicU, csrf, {
        uid: String(profile.userId ?? ''),
        nickname: profile.nickname ?? '',
        avatarUrl: profile.avatarUrl ?? '',
      })
      return true
    } catch (err) {
      const message = (err as Error).message
      // 仅当确认是登录态无效时才跳过该 Cookie，网络错误下一轮重试
      if ((err as { code?: string }).code === 'INVALID_TOKEN') {
        log.warn('[WY 网页登录] Cookie 中的登录态已失效，等待用户在页面中登录')
        lastInvalidRef.current = musicU
      } else {
        log.warn(`[WY 网页登录] 验证登录态失败（${message}），稍后重试`)
      }
      return false
    }
  }

  const checkLoginStatus = async() => {
    let done = false
    let fallbackCsrf = ''
    try {
      for (const url of COOKIE_URLS) {
        const cookie = await getWebViewCookie(url)
        const csrf = pickCookieValue(cookie, '__csrf')
        if (csrf && !fallbackCsrf) fallbackCsrf = csrf
        const musicU = pickMusicU(cookie)
        if (musicU && musicU !== lastInvalidRef.current) {
          done = await trySaveCookie(musicU, csrf || fallbackCsrf)
          if (done) break
        }
      }
    } catch (err) {
      const msg = (err as Error).message
      if (lastReadErrorRef.current !== msg) {
        lastReadErrorRef.current = msg
        log.warn(`[WY 网页登录] 读取 Cookie 失败: ${msg}`)
      }
    }
    if (!canceledRef.current && !done) {
      timerRef.current = setTimeout(() => { void checkLoginStatus() }, CHECK_INTERVAL)
    }
  }

  useEffect(() => {
    canceledRef.current = false
    log.info(`[WY 网页登录] 打开登录页: ${WY_LOGIN_URL}`)
    timerRef.current = setTimeout(() => { void checkLoginStatus() }, CHECK_INTERVAL)
    return () => {
      canceledRef.current = true
      clearTimer()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 加载失败时通过重新挂载 WebView 触发重新加载
  const handleReload = () => {
    setLoadError(false)
  }

  const handleClose = () => {
    void Navigation.dismissOverlay(componentId)
  }

  const statusBarHeight = StatusBar.currentHeight ?? 24

  return (
    <View style={{ ...styles.container, backgroundColor: theme['c-content-background'] }}>
      <View style={{ ...styles.header, paddingTop: statusBarHeight + 8, backgroundColor: theme['c-primary-light-100-alpha-100'] }}>
        <Text style={styles.title} size={16}>{t('wy_web_login_modal_title')}</Text>
      </View>
      <View style={styles.webWrap}>
        {
          loadError
            ? <View style={styles.center}>
                <Text size={13} style={styles.tipText}>{t('wy_web_login_load_fail')}</Text>
                <Button style={{ ...styles.retryBtn, backgroundColor: theme['c-button-background'] }} onPress={handleReload}>
                  <Text color={theme['c-button-font']}>{t('wy_web_login_reload')}</Text>
                </Button>
              </View>
            : <WebView
                source={{ uri: WY_LOGIN_URL }}
                style={styles.webview}
                domStorageEnabled={true}
                javaScriptEnabled={true}
                setSupportMultipleWindows={false}
                startInLoadingState={true}
                renderLoading={() => (
                  <View style={{ ...styles.loadingWrap, backgroundColor: theme['c-content-background'] }}>
                    <Loading />
                  </View>
                )}
                onError={(event: WebViewErrorEvent): void => {
                  const { description, url } = event.nativeEvent
                  log.error(`[WY 网页登录] 登录页加载失败: ${description ?? '-'}（${url}）`)
                  setLoadError(true)
                }}
              />
        }
      </View>
      <View style={styles.footer}>
        <Text size={12} style={styles.tipText}>{t('wy_web_login_tip')}</Text>
        <View style={styles.btns}>
          <Button style={{ ...styles.btn, backgroundColor: theme['c-button-background'] }} onPress={handleClose}>
            <Text color={theme['c-button-font']}>{t('close')}</Text>
          </Button>
        </View>
      </View>
    </View>
  )
}

const styles = createStyle({
  container: {
    flex: 1,
  },
  header: {
    flexGrow: 0,
    flexShrink: 0,
    paddingBottom: 10,
    alignItems: 'center',
  },
  title: {
    textAlign: 'center',
  },
  webWrap: {
    flex: 1,
  },
  webview: {
    flex: 1,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  tipText: {
    textAlign: 'center',
    opacity: 0.7,
    lineHeight: 20,
    marginBottom: 5,
  },
  retryBtn: {
    marginTop: 10,
    paddingTop: 8,
    paddingBottom: 8,
    paddingLeft: 20,
    paddingRight: 20,
    borderRadius: 4,
  },
  footer: {
    flexGrow: 0,
    flexShrink: 0,
    paddingTop: 8,
    paddingLeft: 15,
    paddingRight: 15,
  },
  btns: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingBottom: 15,
  },
  btn: {
    flex: 1,
    paddingTop: 10,
    paddingBottom: 10,
    paddingLeft: 10,
    paddingRight: 10,
    alignItems: 'center',
    borderRadius: 4,
  },
})

export default WyLoginModal

import { useEffect, useMemo, useRef, useState } from 'react'
import { View, Image } from 'react-native'
import { Navigation } from 'react-native-navigation'

import Button from '@/components/common/Button'
import ModalContent from './ModalContent'
import Text from '@/components/common/Text'
import Loading from '@/components/common/Loading'
import { createStyle, toast } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { updateSetting } from '@/core/common'
import { getQrKey, getQrUrl, checkQrStatus } from '@/utils/musicSdk/wy/login'
import { getLoginStatus } from '@/utils/musicSdk/wy/userPlaylist'
import { log } from '@/utils/log'
import qrcode from '@/utils/qrcode'

const POLL_INTERVAL = 2000
const QR_SIZE = 200

// 将二维码矩阵按行合并连续的黑块渲染，减少 View 数量
const QrCodeView = ({ text, size = QR_SIZE }: { text: string, size?: number }) => {
  const { count, cells } = useMemo(() => {
    const qr = qrcode(0, 'M')
    qr.addData(text)
    qr.make()
    const moduleCount = qr.getModuleCount()
    const cellList: Array<{ left: number, top: number, width: number }> = []
    for (let r = 0; r < moduleCount; r++) {
      let c = 0
      while (c < moduleCount) {
        if (!qr.isDark(r, c)) {
          c++
          continue
        }
        let len = 0
        while (c + len < moduleCount && qr.isDark(r, c + len)) len++
        cellList.push({ left: c, top: r, width: len })
        c += len
      }
    }
    return { count: moduleCount, cells: cellList }
  }, [text])

  const cellSize = Math.floor(size / count)
  return (
    <View style={{ width: cellSize * count, height: cellSize * count, backgroundColor: '#fff' }}>
      {
        cells.map((cell, index) => (
          <View
            key={index}
            style={{
              position: 'absolute',
              left: cell.left * cellSize,
              top: cell.top * cellSize,
              width: cell.width * cellSize,
              height: cellSize,
              backgroundColor: '#000',
            }}
          />
        ))
      }
    </View>
  )
}

type LoginStatus = 'loading' | 'waiting' | 'scanned' | 'expired' | 'error'

const WyQrLoginModal = ({ componentId }: { componentId: string }) => {
  const theme = useTheme()
  const t = useI18n()
  const [status, setStatus] = useState<LoginStatus>('loading')
  const [qrUrl, setQrUrl] = useState('')
  const [scannedInfo, setScannedInfo] = useState<{ nickname: string, avatarUrl: string } | null>(null)
  const canceledRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // 当前有效的二维码 key，用于丢弃旧二维码的延迟响应
  const unikeyRef = useRef('')
  // 上次的状态码 / 错误信息，避免轮询期间重复写相同日志
  const lastCodeRef = useRef(0)
  const lastErrorRef = useRef('')

  const clearTimer = () => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  const handleSuccess = async(musicU: string) => {
    log.info(`[WY 扫码登录] 扫码确认成功，已获取 MUSIC_U（长度: ${musicU.length}）`)
    let userInfo = {
      uid: '',
      nickname: scannedInfo?.nickname ?? '',
      avatarUrl: scannedInfo?.avatarUrl ?? '',
    }
    // 登录成功后补全用户信息
    try {
      const profile = await getLoginStatus(musicU)
      userInfo = {
        uid: String(profile.userId ?? ''),
        nickname: profile.nickname ?? userInfo.nickname,
        avatarUrl: profile.avatarUrl ?? userInfo.avatarUrl,
      }
    } catch (err) {
      log.warn(`[WY 扫码登录] 获取用户信息失败（仍保存 Token）: ${(err as Error).message}`)
    }
    // 保存登录状态，下次打开直接使用
    updateSetting({
      'wy.musicUToken': musicU,
      'wy.userInfo': JSON.stringify(userInfo),
    })
    log.info(`[WY 扫码登录] 登录成功，uid: ${userInfo.uid || '-'}，nickname: ${userInfo.nickname || '-'}`)
    toast(t('wy_login_success'))
    void Navigation.dismissOverlay(componentId)
  }

  const handleQrStatus = async(unikey: string) => {
    if (unikey !== unikeyRef.current) return
    try {
      const body = await checkQrStatus(unikey)
      if (canceledRef.current || unikey !== unikeyRef.current) return
      if (body.code !== lastCodeRef.current) {
        lastCodeRef.current = body.code
        log.info(`[WY 扫码登录] 状态变更: ${body.code}${body.message ? `（${body.message}）` : ''}`)
      }
      lastErrorRef.current = ''
      switch (body.code) {
        case 800: // 二维码过期
          setStatus('expired')
          return
        case 801: // 等待扫码
          setStatus('waiting')
          break
        case 802: // 已扫码，等待手机确认
          setScannedInfo({ nickname: body.nickname ?? '', avatarUrl: body.avatarUrl ?? '' })
          setStatus('scanned')
          break
        case 803: // 登录成功
          if (body.musicU) {
            await handleSuccess(body.musicU)
            return
          }
          log.error('[WY 扫码登录] 服务端确认成功但未提取到 MUSIC_U')
          setStatus('error')
          return
        default:
          log.warn(`[WY 扫码登录] 未知状态码: ${body.code}`)
          setStatus('error')
          return
      }
    } catch (err) {
      if (canceledRef.current) return
      // 网络波动时继续轮询，避免中断登录流程
      const msg = (err as Error).message
      if (lastErrorRef.current !== msg) {
        lastErrorRef.current = msg
        log.warn(`[WY 扫码登录] 状态检查异常（继续轮询）: ${msg}`)
      }
    }
    if (!canceledRef.current && unikey === unikeyRef.current) {
      timerRef.current = setTimeout(() => { void handleQrStatus(unikey) }, POLL_INTERVAL)
    }
  }

  const handleRefresh = () => {
    clearTimer()
    setScannedInfo(null)
    setStatus('loading')
    unikeyRef.current = ''
    lastCodeRef.current = 0
    log.info('[WY 扫码登录] 获取二维码...')
    Promise.resolve()
      .then(async() => {
        const unikey = await getQrKey()
        if (canceledRef.current) return
        log.info(`[WY 扫码登录] 二维码已生成，unikey: ${unikey}`)
        unikeyRef.current = unikey
        setQrUrl(getQrUrl(unikey))
        setStatus('waiting')
        timerRef.current = setTimeout(() => { void handleQrStatus(unikey) }, POLL_INTERVAL)
      })
      .catch(err => {
        if (canceledRef.current) return
        log.warn(`[WY 扫码登录] 获取二维码失败: ${err.message}`)
        setStatus('error')
      })
  }

  useEffect(() => {
    canceledRef.current = false
    handleRefresh()
    return () => {
      canceledRef.current = true
      clearTimer()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleClose = () => {
    void Navigation.dismissOverlay(componentId)
  }

  return (
    <ModalContent>
      <View style={styles.main}>
        <Text style={styles.title} size={18}>{t('wy_login_modal_title')}</Text>
        <Text size={11} style={styles.unstableTip}>{t('wy_qr_login_unstable_tip')}</Text>
        {
          status === 'loading'
            ? <View style={styles.center}><Loading /></View>
            : null
        }
        {
          status === 'waiting' || status === 'scanned'
            ? <>
                <View style={styles.qrWrap}>
                  <QrCodeView text={qrUrl} />
                </View>
                <View style={styles.center}>
                  {
                    status === 'scanned' && scannedInfo
                      ? <View style={styles.scannedRow}>
                          {scannedInfo.avatarUrl
                            ? <Image style={styles.avatar} source={{ uri: scannedInfo.avatarUrl }} />
                            : null}
                          <View style={styles.scannedInfo}>
                            {scannedInfo.nickname ? <Text size={13} numberOfLines={1}>{scannedInfo.nickname}</Text> : null}
                            <Text size={12} style={styles.tipText} numberOfLines={2}>{t('wy_login_scanned')}</Text>
                          </View>
                        </View>
                      : <Text size={13} style={styles.tipText}>{t('wy_login_tip_scan')}</Text>
                  }
                </View>
              </>
            : null
        }
        {
          status === 'expired' || status === 'error'
            ? <View style={styles.center}>
                <Text size={13} style={styles.tipText}>{status === 'expired' ? t('wy_login_expired') : t('wy_login_load_fail')}</Text>
                <Button style={{ ...styles.retryBtn, backgroundColor: theme['c-button-background'] }} onPress={handleRefresh}>
                  <Text color={theme['c-button-font']}>{t('wy_login_refresh')}</Text>
                </Button>
              </View>
            : null
        }
      </View>
      <View style={styles.btns}>
        <Button style={{ ...styles.btn, backgroundColor: theme['c-button-background'] }} onPress={handleClose}>
          <Text color={theme['c-button-font']}>{t('close')}</Text>
        </Button>
      </View>
    </ModalContent>
  )
}

const styles = createStyle({
  main: {
    flexShrink: 1,
    marginTop: 15,
    marginBottom: 10,
    paddingLeft: 25,
    paddingRight: 25,
  },
  title: {
    textAlign: 'center',
    marginBottom: 4,
  },
  unstableTip: {
    textAlign: 'center',
    opacity: 0.55,
    lineHeight: 16,
    marginBottom: 6,
  },
  center: {
    alignItems: 'center',
    paddingBottom: 5,
  },
  tipText: {
    textAlign: 'center',
    opacity: 0.7,
    lineHeight: 20,
    marginBottom: 5,
  },
  qrWrap: {
    alignSelf: 'center',
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 4,
    marginTop: 5,
    marginBottom: 10,
  },
  scannedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 10,
    paddingRight: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
    backgroundColor: 'rgba(128,128,128,0.2)',
  },
  scannedInfo: {
    flexShrink: 1,
  },
  retryBtn: {
    marginTop: 10,
    paddingTop: 8,
    paddingBottom: 8,
    paddingLeft: 20,
    paddingRight: 20,
    borderRadius: 4,
  },
  btns: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingBottom: 15,
    paddingLeft: 15,
  },
  btn: {
    flex: 1,
    paddingTop: 10,
    paddingBottom: 10,
    paddingLeft: 10,
    paddingRight: 10,
    alignItems: 'center',
    borderRadius: 4,
    marginRight: 15,
  },
})

export default WyQrLoginModal

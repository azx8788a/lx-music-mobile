import { useCallback, useEffect, useRef, useState } from 'react'
import { View } from 'react-native'

import OnlineList, { type OnlineListType } from '@/components/OnlineList'
import PageContent from '@/components/PageContent'
import StatusBar from '@/components/common/StatusBar'
import Button from '@/components/common/Button'
import Text from '@/components/common/Text'
import Loading from '@/components/common/Loading'
import PlayerBar from '@/components/player/PlayerBar'
import { setTempList } from '@/core/list'
import { playList } from '@/core/player/player'
import { LIST_IDS } from '@/config/constant'
import { getPersonalFmList } from '@/core/wyRecommend'
import { showWyLoginModal } from '@/navigation/utils'
import { useSettingValue } from '@/store/setting/hook'
import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { log } from '@/utils/log'


type PageStatus = 'loading' | 'noToken' | 'invalid' | 'list' | 'error'

export default ({ componentId }: { componentId: string }) => {
  const theme = useTheme()
  const t = useI18n()
  const token = useSettingValue('wy.musicUToken')
  const onlineListRef = useRef<OnlineListType>(null)
  const [status, setStatus] = useState<PageStatus>('loading')
  const queueRef = useRef<{ id: string, index: number }>({ id: '', index: 0 })

  const loadBatch = useCallback(async() => {
    if (!token) {
      setStatus('noToken')
      return
    }
    try {
      const list = await getPersonalFmList()
      if (!list.length) {
        // 空批次不视为失败：保持当前列表，仅记录日志
        log.info('[WY 漫游] 本次未获取到新歌曲')
        return
      }
      const fmId = `wy_fm_${Date.now()}`
      queueRef.current = { id: fmId, index: 0 }
      await setTempList(fmId, list)
      onlineListRef.current?.setList(list)
      setStatus('list')
      log.info(`[WY 漫游] 获取 ${list.length} 首`)
    } catch (err: any) {
      // token 失效：明确提示；其他错误仅在空列表时展示
      if (err?.code == 'INVALID_TOKEN') {
        setStatus('invalid')
      } else if (queueRef.current.id == '') {
        setStatus('error')
      }
      log.warn(`[WY 漫游] 获取失败: ${(err as Error).message}`)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  useEffect(() => {
    void loadBatch()
  }, [loadBatch])

  const handlePlayList = (index: number) => {
    void playList(LIST_IDS.TEMP, index)
  }

  const handleLoadMore = () => {
    if (queueRef.current.id) onlineListRef.current?.setStatus('idle')
  }

  const handleRetry = () => { void loadBatch() }
  const handleLogin = () => { showWyLoginModal() }

  return (
    <PageContent>
      <StatusBar />
      <View style={{ ...styles.header, borderBottomColor: theme['c-border-background'] }}>
        <Text size={16} numberOfLines={1} style={styles.title}>
          {t('wy_radio_fm')}
        </Text>
        <Text size={11} style={styles.sub}>{t('wy_radio_refresh_tip')}</Text>
      </View>
      {
        status == 'loading'
          ? <View style={styles.center}><Loading /></View>
          : null
      }
      {
        status == 'noToken'
          ? <View style={styles.center}>
              <Text size={13} style={styles.tipText}>{t('wy_playlist_token_guide')}</Text>
              <Button style={{ ...styles.smallBtn, backgroundColor: theme['c-button-background'] }} onPress={handleLogin}>
                <Text color={theme['c-button-font']}>{t('wy_playlist_login')}</Text>
              </Button>
            </View>
          : null
      }
      {
        status == 'invalid'
          ? <View style={styles.center}>
              <Text size={13} style={styles.tipText}>{t('wy_recommend_token_invalid')}</Text>
              <Button style={{ ...styles.smallBtn, backgroundColor: theme['c-button-background'] }} onPress={handleLogin}>
                <Text color={theme['c-button-font']}>{t('wy_playlist_relogin')}</Text>
              </Button>
            </View>
          : null
      }
      {
        status == 'error'
          ? <View style={styles.center}>
              <Text size={13} style={styles.tipText}>{t('wy_radio_failed')}</Text>
              <Button style={{ ...styles.smallBtn, backgroundColor: theme['c-button-background'] }} onPress={handleRetry}>
                <Text color={theme['c-button-font']}>{t('wy_playlist_retry')}</Text>
              </Button>
            </View>
          : null
      }
      {
        status == 'list'
          ? <OnlineList ref={onlineListRef} onRefresh={loadBatch} onLoadMore={handleLoadMore} onPlayList={handlePlayList} />
          : null
      }
      <PlayerBar />
    </PageContent>
  )
}

const styles = createStyle({
  header: {
    borderBottomWidth: 1,
    paddingTop: 8,
    paddingBottom: 6,
    paddingLeft: 15,
    paddingRight: 15,
  },
  title: {
    fontWeight: 'bold',
  },
  sub: {
    opacity: 0.55,
    marginTop: 3,
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
    marginBottom: 12,
  },
  smallBtn: {
    paddingTop: 8,
    paddingBottom: 8,
    paddingLeft: 22,
    paddingRight: 22,
    borderRadius: 4,
  },
})

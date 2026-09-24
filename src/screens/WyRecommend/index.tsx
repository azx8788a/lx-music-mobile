import { useCallback, useEffect, useRef, useState } from 'react'
import { View } from 'react-native'

import OnlineList, { type OnlineListType } from '@/components/OnlineList'
import PageContent from '@/components/PageContent'
import StatusBar from '@/components/common/StatusBar'
import Button from '@/components/common/Button'
import Text from '@/components/common/Text'
import Loading from '@/components/common/Loading'
import PlayerBar from '@/components/player/PlayerBar'
import { handlePlay } from '@/components/OnlineList/listAction'
import { setTempList } from '@/core/list'
import { playList } from '@/core/player/player'
import { LIST_IDS } from '@/config/constant'
import { getDailyRecommend } from '@/core/wyRecommend'
import { showWyLoginModal } from '@/navigation/utils'
import { useSettingValue } from '@/store/setting/hook'
import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { log } from '@/utils/log'


type PageStatus = 'loading' | 'noToken' | 'invalid' | 'empty' | 'list' | 'error'

export default ({ componentId }: { componentId: string }) => {
  const theme = useTheme()
  const t = useI18n()
  const token = useSettingValue('wy.musicUToken')
  const onlineListRef = useRef<OnlineListType>(null)
  const [status, setStatus] = useState<PageStatus>('loading')
  const [recommendId, setRecommendId] = useState('')

  const load = useCallback(async() => {
    if (!token) {
      setStatus('noToken')
      return
    }
    setStatus('loading')
    try {
      const list = await getDailyRecommend()
      if (!list.length) {
        setStatus('empty')
        return
      }
      setRecommendId(`wy_recommend_${Date.now()}`)
      await setTempList(recommendId, list)
      onlineListRef.current?.setList(list)
      setStatus('list')
      log.info(`[WY 每日推荐] 展示 ${list.length} 首推荐歌曲`)
    } catch (err: any) {
      setStatus(err?.code == 'INVALID_TOKEN' ? 'invalid' : 'error')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  useEffect(() => {
    void load()
  }, [load])

  const handleRefresh = () => { void load() }
  const handleLoadMore = () => { onlineListRef.current?.setStatus('end') }

  const handlePlayList = (index: number) => {
    if (!recommendId) return
    void playList(LIST_IDS.TEMP, index)
  }

  const handleRetry = () => { void load() }
  const handleLogin = () => { showWyLoginModal() }

  const emptyContent = (tip: string, actionText?: string, action?: () => void) => (
    <View style={styles.center}>
      <Text size={13} style={styles.tipText}>{tip}</Text>
      {
        action && actionText
          ? <Button style={{ ...styles.smallBtn, backgroundColor: theme['c-button-background'] }} onPress={action}>
              <Text color={theme['c-button-font']}>{actionText}</Text>
            </Button>
          : null
      }
    </View>
  )

  return (
    <PageContent>
      <StatusBar />
      <View style={{ ...styles.header, borderBottomColor: theme['c-border-background'] }}>
        <Text size={16} numberOfLines={1} style={styles.title}>{t('wy_recommend_title')}</Text>
      </View>
      {
        status == 'loading'
          ? <View style={styles.center}><Loading /></View>
          : null
      }
      {
        status == 'noToken'
          ? emptyContent(t('wy_playlist_token_guide'), t('wy_playlist_login'), handleLogin)
          : null
      }
      {
        status == 'invalid'
          ? emptyContent(t('wy_recommend_token_invalid'), t('wy_playlist_relogin'), handleLogin)
          : null
      }
      {
        status == 'empty'
          ? emptyContent(t('wy_recommend_empty'))
          : null
      }
      {
        status == 'error'
          ? emptyContent(t('wy_recommend_failed'), t('wy_playlist_retry'), handleRetry)
          : null
      }
      {
        status == 'list'
          ? <OnlineList ref={onlineListRef} onRefresh={handleRefresh} onLoadMore={handleLoadMore} onPlayList={handlePlayList} />
          : null
      }
      <PlayerBar />
    </PageContent>
  )
}

export const playWyRecommend = (list: LX.Music.MusicInfoOnline[], index: number) => {
  // 供入口处快速播放使用（与 handlePlay 相同的默认列表路径）
  if (list[index]) handlePlay(list[index])
}

const styles = createStyle({
  header: {
    borderBottomWidth: 1,
    paddingTop: 8,
    paddingBottom: 8,
    paddingLeft: 15,
    paddingRight: 15,
  },
  title: {
    fontWeight: 'bold',
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

import { useEffect, useState } from 'react'
import { FlatList, RefreshControl, TouchableOpacity, View } from 'react-native'

import Button from '@/components/common/Button'
import Image from '@/components/common/Image'
import Loading from '@/components/common/Loading'
import Text from '@/components/common/Text'
import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { useSettingValue } from '@/store/setting/hook'
import commonState, { type InitState as CommonState } from '@/store/common/state'
import { NAV_SHEAR_NATIVE_IDS } from '@/config/constant'
import { getLoginStatus, getUserPlaylistList } from '@/utils/musicSdk/wy/userPlaylist'
import { showWyLoginModal, showWyQrLoginModal } from '@/navigation/utils'
import { navigations } from '@/navigation'
import { log } from '@/utils/log'

interface PlaylistInfo {
  id: string
  name: string
  trackCount: number
  author: string
  img: string
}

type Status = 'emptyToken' | 'loading' | 'list' | 'error'

const loadPlaylists = async(token: string) => {
  const profile = await getLoginStatus(token)
  const list = await getUserPlaylistList({ uid: profile.userId, token })
  const items: PlaylistInfo[] = list
    .filter((item: any) => item.trackCount > 0)
    .map((item: any) => ({
      id: String(item.id),
      name: item.name,
      trackCount: item.trackCount,
      author: item.creator?.nickname ?? '',
      img: item.coverImgUrl ?? '',
    }))
  return { uid: String(profile.userId ?? ''), items }
}

const ListItem = ({ item, onPress }: { item: PlaylistInfo, onPress: (item: PlaylistInfo) => void }) => {
  const theme = useTheme()
  return (
    <TouchableOpacity style={styles.item} activeOpacity={0.6} onPress={() => { onPress(item) }}>
      <Image url={item.img} nativeID={`${NAV_SHEAR_NATIVE_IDS.songlistDetail_pic}_from_${item.id}`} style={styles.itemImg} />
      <View style={styles.itemMain}>
        <Text size={14} numberOfLines={1}>{item.name}</Text>
        <Text size={11} style={styles.itemDesc} numberOfLines={1}>{item.trackCount} · {item.author}</Text>
      </View>
      <Text style={{ ...styles.arrow, color: theme['c-primary-font'] }} size={14}>›</Text>
    </TouchableOpacity>
  )
}

export default () => {
  const t = useI18n()
  const theme = useTheme()
  const token = useSettingValue('wy.musicUToken')
  const [status, setStatus] = useState<Status>(token ? 'loading' : 'emptyToken')
  const [playlists, setPlaylists] = useState<PlaylistInfo[]>([])
  const [refreshing, setRefreshing] = useState(false)

  const reload = (isRefresh = false) => {
    if (!token) {
      setStatus('emptyToken')
      return
    }
    if (isRefresh) setRefreshing(true)
    else setStatus('loading')
    log.info('[WY 歌单页] 开始获取歌单列表')
    void loadPlaylists(token)
      .then(({ uid, items }) => {
        setPlaylists(items)
        setStatus('list')
        log.info(`[WY 歌单页] 歌单获取成功，共 ${items.length} 个（uid: ${uid}）`)
      })
      .catch((err: Error) => {
        log.warn(`[WY 歌单页] 歌单获取失败: ${err.message}`)
        // 登录态失效时展示错误状态引导重新登录，其余情况下拉刷新失败时保留已有列表
        if (!isRefresh || (err as Error & { code?: string }).code === 'INVALID_TOKEN') setStatus('error')
      })
      .finally(() => {
        setRefreshing(false)
      })
  }

  // 登录状态变化（登录成功 / 退出登录）后自动重新加载
  useEffect(() => {
    reload()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  // 再次进入本页面时刷新，保持歌单列表最新
  useEffect(() => {
    const handleNavIdUpdate = (id: CommonState['navActiveId']) => {
      if (id == 'nav_wy_songlist') reload(true)
    }
    global.state_event.on('navActiveIdUpdated', handleNavIdUpdate)
    return () => {
      global.state_event.off('navActiveIdUpdated', handleNavIdUpdate)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const handleRefresh = () => {
    reload(true)
  }

  const handleRetry = () => {
    reload()
  }

  const handleOpen = (item: PlaylistInfo) => {
    if (!commonState.componentIds.home) return
    navigations.pushSonglistDetailScreen(commonState.componentIds.home, {
      play_count: undefined,
      id: item.id,
      author: item.author,
      name: item.name,
      img: item.img,
      desc: undefined,
      source: 'wy',
    })
  }

  return (
    <View style={{ ...styles.container, backgroundColor: theme['c-content-background'] }}>
      {
        status == 'loading'
          ? <View style={styles.center}><Loading /></View>
          : null
      }
      {
        status == 'emptyToken'
          ? <View style={styles.center}>
              <Text size={13} style={styles.tipText}>{t('wy_playlist_token_empty')}</Text>
              <Text size={13} style={styles.tipText}>{t('wy_playlist_token_guide')}</Text>
              <View style={styles.btnRow}>
                <Button style={{ ...styles.smallBtn, backgroundColor: theme['c-button-background'] }} onPress={showWyLoginModal}>
                  <Text color={theme['c-button-font']}>{t('wy_playlist_login')}</Text>
                </Button>
                <Button style={{ ...styles.smallBtn, ...styles.smallBtnLast, backgroundColor: theme['c-button-background'] }} onPress={showWyQrLoginModal}>
                  <Text color={theme['c-button-font']}>{t('wy_playlist_qr_login')}</Text>
                </Button>
              </View>
            </View>
          : null
      }
      {
        status == 'error'
          ? <View style={styles.center}>
              <Text size={13} style={styles.tipText}>{t('wy_playlist_load_fail')}</Text>
              <View style={styles.btnRow}>
                <Button style={{ ...styles.smallBtn, backgroundColor: theme['c-button-background'] }} onPress={handleRetry}>
                  <Text color={theme['c-button-font']}>{t('wy_playlist_retry')}</Text>
                </Button>
                <Button style={{ ...styles.smallBtn, ...styles.smallBtnLast, backgroundColor: theme['c-button-background'] }} onPress={showWyLoginModal}>
                  <Text color={theme['c-button-font']}>{t('wy_playlist_relogin')}</Text>
                </Button>
              </View>
            </View>
          : null
      }
      {
        status == 'list'
          ? <FlatList
              data={playlists}
              renderItem={({ item }) => <ListItem item={item} onPress={handleOpen} />}
              keyExtractor={item => item.id}
              refreshControl={
                <RefreshControl
                  colors={[theme['c-primary']]}
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                />
              }
              ListEmptyComponent={<Text size={13} style={styles.emptyText}>{t('wy_playlist_empty')}</Text>}
              contentContainerStyle={styles.listContent}
            />
          : null
      }
    </View>
  )
}

const styles = createStyle({
  container: {
    flex: 1,
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
  btnRow: {
    flexDirection: 'row',
    marginTop: 10,
  },
  smallBtn: {
    paddingTop: 8,
    paddingBottom: 8,
    paddingLeft: 20,
    paddingRight: 20,
    borderRadius: 4,
    marginRight: 15,
  },
  smallBtnLast: {
    marginRight: 0,
  },
  listContent: {
    paddingTop: 5,
    paddingBottom: 15,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 8,
    paddingLeft: 15,
    paddingRight: 15,
  },
  itemImg: {
    width: 52,
    height: 52,
    borderRadius: 4,
    marginRight: 12,
  },
  itemMain: {
    flexGrow: 1,
    flexShrink: 1,
    marginRight: 10,
  },
  itemDesc: {
    opacity: 0.6,
    marginTop: 4,
  },
  arrow: {
    flexShrink: 0,
  },
  emptyText: {
    textAlign: 'center',
    opacity: 0.7,
    marginTop: 40,
  },
})

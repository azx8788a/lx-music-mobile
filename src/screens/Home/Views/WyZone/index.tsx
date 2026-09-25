// 网易云专区：二级菜单页（每日推荐、私人漫游、心动模式、我的歌单）
import { useState } from 'react'
import { View, TouchableOpacity, ScrollView } from 'react-native'
import Text from '@/components/common/Text'
import Loading from '@/components/common/Loading'
import { createStyle, toast } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { useSettingValue } from '@/store/setting/hook'
import { navigations } from '@/navigation'
import commonState from '@/store/common/state'
import { showWyLoginModal } from '@/navigation/utils'
import { getPersonalFmList, getHeartbeatList } from '@/core/wyRecommend'
import { setTempList } from '@/core/list'
import { playList } from '@/core/player/player'
import { LIST_IDS } from '@/config/constant'
import WySonglist from '../WySonglist'
import { log } from '@/utils/log'

type MenuId = 'recommend' | 'fm' | 'heartbeat' | 'playlist'

interface MenuItem {
  id: MenuId
  title: string
  desc: string
}

// 点击一次最多聚合 3 批歌曲（每批约 3 首），保证请求次数有界，不会产生持续自动请求
const MAX_RADIO_FETCH = 3
const RADIO_BATCH_TARGET = 9

const fetchRadioQueue = async(mode: 'fm' | 'heartbeat') => {
  let acc: LX.Music.MusicInfoOnline[] = []
  for (let i = 0; i < MAX_RADIO_FETCH && acc.length < RADIO_BATCH_TARGET; i++) {
    let list: LX.Music.MusicInfoOnline[]
    try {
      list = mode == 'fm' ? await getPersonalFmList() : await getHeartbeatList()
    } catch (err) {
      // 已有部分歌曲时保留现有结果直接使用，否则向上抛出由调用方提示
      if (acc.length) {
        break
      }
      throw err
    }
    if (!list.length) {
      break
    }
    acc = acc.concat(list)
  }
  // 去重（保持顺序）
  const seen = new Set<string>()
  const out: LX.Music.MusicInfoOnline[] = []
  for (const music of acc) {
    if (seen.has(music.id)) {
      continue
    }
    seen.add(music.id)
    out.push(music)
  }
  return out
}

export default () => {
  const t = useI18n()
  const theme = useTheme()
  const token = useSettingValue('wy.musicUToken')
  const [loading, setLoading] = useState<string | null>(null)
  const [subView, setSubView] = useState<'menu' | 'playlists'>('menu')

  const menus: MenuItem[] = [
    { id: 'recommend', title: t('wy_recommend_entry'), desc: t('wy_zone_recommend_desc') },
    { id: 'fm', title: t('wy_radio_entry'), desc: t('wy_zone_radio_desc') },
    { id: 'heartbeat', title: t('wy_heartbeat_entry'), desc: t('wy_zone_heartbeat_desc') },
    { id: 'playlist', title: t('wy_zone_playlist_title'), desc: t('wy_zone_playlist_desc') },
  ]

  // 每日推荐：跳转详情页（未登录由详情页内引导登录）
  const handleRecommend = () => {
    if (!commonState.componentIds.home) {
      return
    }
    navigations.pushWyRecommendScreen(commonState.componentIds.home)
  }

  // 私人漫游 / 心动模式：点击直接开始播放，不展示列表
  const handlePlayRadio = async(mode: 'fm' | 'heartbeat') => {
    if (!token) {
      toast(t('wy_playlist_token_empty'))
      return
    }
    const modeText = mode == 'fm' ? t('wy_radio_fm') : t('wy_radio_heartbeat')
    setLoading(mode)
    try {
      log.info(`[WY 专区] 开始播放${modeText}`)
      const list = await fetchRadioQueue(mode)
      if (!list.length) {
        toast(t('wy_radio_empty'))
        return
      }
      const radioId = mode == 'fm' ? 'wy_personal_fm' : 'wy_heartbeat'
      await setTempList(radioId, list)
      void playList(LIST_IDS.TEMP, 0)
      toast(t('wy_radio_playing', { mode: modeText, count: list.length }))
    } catch (err: any) {
      if (err.code == 'INVALID_TOKEN') {
        toast(t('wy_recommend_token_invalid'))
      } else if (err.code == 'NO_TOKEN') {
        toast(t('wy_playlist_token_empty'))
      } else {
        toast(t('wy_radio_failed'))
        log.warn(`[WY 专区] ${modeText}播放失败: ${(err as Error).message}`)
      }
    } finally {
      setLoading(null)
    }
  }

  const handleMenuPress = (id: MenuId) => {
    if (loading != null) {
      return
    }
    switch (id) {
      case 'recommend':
        handleRecommend()
        break
      case 'fm':
        void handlePlayRadio('fm')
        break
      case 'heartbeat':
        void handlePlayRadio('heartbeat')
        break
      case 'playlist':
        setSubView('playlists')
        break
    }
  }

  // 我的歌单：专区内的二级视图（复用现有歌单页，支持离线快照）
  if (subView == 'playlists') {
    return (
      <View style={{ ...styles.container, backgroundColor: theme['c-content-background'] }}>
        <View style={{ ...styles.subHeader, borderBottomColor: theme['c-border-background'] }}>
          <TouchableOpacity style={styles.backBtn} onPress={() => { setSubView('menu') }}>
            <Text size={13} color={theme['c-primary-font']}>‹ {t('back')}</Text>
          </TouchableOpacity>
          <Text size={15} numberOfLines={1} style={styles.subTitle}>{t('wy_zone_playlist_title')}</Text>
        </View>
        <WySonglist />
      </View>
    )
  }

  return (
    <View style={{ ...styles.container, backgroundColor: theme['c-content-background'] }}>
      {
        !token
          ? <TouchableOpacity style={{ ...styles.loginTip, borderBottomColor: theme['c-border-background'] }} onPress={showWyLoginModal}>
              <Text size={12} color={theme['c-primary-font']}>{t('wy_playlist_token_empty')} · {t('wy_playlist_login')} ›</Text>
            </TouchableOpacity>
          : null
      }
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {menus.map(menu => (
          <TouchableOpacity
            key={menu.id}
            style={{ ...styles.menuItem, borderBottomColor: theme['c-border-background'] }}
            activeOpacity={0.7}
            onPress={() => { handleMenuPress(menu.id) }}
            disabled={loading != null}
          >
            <View style={styles.menuMain}>
              <Text size={16}>{menu.title}</Text>
              <Text size={12} style={styles.menuDesc}>{menu.desc}</Text>
            </View>
            {loading == menu.id
              ? <Loading size={18} />
              : <Text style={{ color: theme['c-primary-font'] }} size={16}>›</Text>
            }
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  )
}

const styles = createStyle({
  container: {
    flex: 1,
  },
  loginTip: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  scrollContent: {
    paddingTop: 6,
    paddingBottom: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  menuMain: {
    flex: 1,
  },
  menuDesc: {
    opacity: 0.6,
    marginTop: 4,
  },
  subHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
  },
  backBtn: {
    marginRight: 15,
  },
  subTitle: {
    fontWeight: 'bold',
  },
})

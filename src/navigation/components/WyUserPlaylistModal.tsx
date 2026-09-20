import { useEffect, useState } from 'react'
import { View, ScrollView, TouchableOpacity } from 'react-native'
import { Navigation } from 'react-native-navigation'

import Button from '@/components/common/Button'
import ModalContent from './ModalContent'
import Text from '@/components/common/Text'
import Loading from '@/components/common/Loading'
import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { useSettingValue } from '@/store/setting/hook'
import commonState from '@/store/common/state'
import { getUserPlaylistList, getLoginStatus } from '@/utils/musicSdk/wy/userPlaylist'
import { showWyLoginModal } from '@/navigation/utils'
import { navigations } from '@/navigation'


interface PlaylistInfo {
  id: string
  name: string
  trackCount: number
  author: string
  img: string
}

let playlists: PlaylistInfo[] = []

const Content = ({ componentId }: { componentId: string }) => {
  const theme = useTheme()
  const t = useI18n()
  const token = useSettingValue('wy.musicUToken')
  const [status, setStatus] = useState(token ? 'loading' : 'emptyToken')

  const handleLoad = () => {
    if (!token) {
      setStatus('emptyToken')
      return
    }
    setStatus('loading')
    Promise.resolve()
      .then(async() => {
        const profile = await getLoginStatus(token)
        const list = await getUserPlaylistList({ uid: profile.userId, token })
        playlists = list
          .filter((item: any) => item.trackCount > 0)
          .map((item: any) => ({
            id: String(item.id),
            name: item.name,
            trackCount: item.trackCount,
            author: item.creator?.nickname ?? '',
            img: item.coverImgUrl ?? '',
          }))
        setStatus('list')
      })
      .catch(err => {
        console.log(err.message)
        setStatus('error')
      })
  }

  // 登录状态变化（扫码登录成功 / 退出登录）后自动重新加载
  useEffect(() => {
    handleLoad()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const handleLogin = () => {
    showWyLoginModal()
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
    void Navigation.dismissOverlay(componentId)
  }

  const handleClose = () => {
    void Navigation.dismissOverlay(componentId)
  }

  return (
    <ModalContent>
      <View style={styles.main}>
        <Text style={styles.title} size={18}>{t('wy_playlist_modal_title')}</Text>
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
                <Button style={{ ...styles.smallBtn, ...styles.smallBtnLast, backgroundColor: theme['c-button-background'] }} onPress={handleLogin}>
                  <Text color={theme['c-button-font']}>{t('wy_playlist_login')}</Text>
                </Button>
              </View>
            : null
        }
        {
          status == 'error'
            ? <View style={styles.center}>
                <Text size={13} style={styles.tipText}>{t('wy_playlist_load_fail')}</Text>
                <View style={styles.btnRow}>
                  <Button style={{ ...styles.smallBtn, backgroundColor: theme['c-button-background'] }} onPress={handleLoad}>
                    <Text color={theme['c-button-font']}>{t('wy_playlist_retry')}</Text>
                  </Button>
                  <Button style={{ ...styles.smallBtn, ...styles.smallBtnLast, backgroundColor: theme['c-button-background'] }} onPress={handleLogin}>
                    <Text color={theme['c-button-font']}>{t('wy_playlist_relogin')}</Text>
                  </Button>
                </View>
              </View>
            : null
        }
        {
          status == 'list'
            ? <ScrollView style={styles.content}>
                {
                  playlists.length
                    ? playlists.map(item => (
                        <TouchableOpacity key={item.id} style={styles.item} activeOpacity={0.6} onPress={() => { handleOpen(item) }}>
                          <View style={styles.itemMain}>
                            <Text size={14} numberOfLines={1}>{item.name}</Text>
                            <Text size={11} style={styles.itemDesc} numberOfLines={1}>{item.trackCount} · {item.author}</Text>
                          </View>
                          <Text style={{ ...styles.arrow, color: theme['c-primary-font'] }} size={14}>›</Text>
                        </TouchableOpacity>
                    ))
                    : <Text size={13} style={styles.tipText}>{t('wy_playlist_empty')}</Text>
                }
              </ScrollView>
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

const WyUserPlaylistModal = ({ componentId }: { componentId: string }) => {
  return <Content componentId={componentId} />
}

const styles = createStyle({
  main: {
    flexShrink: 1,
    marginTop: 15,
    marginBottom: 10,
  },
  title: {
    textAlign: 'center',
    marginBottom: 10,
  },
  center: {
    padding: 20,
    alignItems: 'center',
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
  content: {
    flexGrow: 0,
    flexShrink: 1,
    paddingLeft: 15,
    paddingRight: 15,
    maxHeight: 320,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128,128,128,0.15)',
  },
  itemMain: {
    flexGrow: 1,
    flexShrink: 1,
    marginRight: 10,
  },
  itemDesc: {
    opacity: 0.6,
    marginTop: 3,
  },
  arrow: {
    flexShrink: 0,
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

export default WyUserPlaylistModal

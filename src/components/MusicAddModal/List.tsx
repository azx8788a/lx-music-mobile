import { useMemo, useRef, useState } from 'react'
import { ScrollView, TouchableOpacity, View } from 'react-native'

import Text from '@/components/common/Text'
import { useMyList } from '@/store/list/hook'
import ListItem, { styles as listStyles } from './ListItem'
import CreateUserList from './CreateUserList'
import { useWindowSize } from '@/utils/hooks'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { createStyle, toast } from '@/utils/tools'
import { scaleSizeW } from '@/utils/pixelRatio'
import settingState from '@/store/setting/state'
import WyPlaylistPicker, { type WyPlaylistPickerType } from '@/components/WyPlaylistPicker'
import { wyTrackIdsFromMusics, favoriteToWyPlaylist, addTracksToWyPlaylist, toastWyWriteResult } from '@/core/wyPlaylistWrite'

const styles = createStyle({
  list: {
    paddingLeft: 15,
    paddingRight: 2,
    paddingBottom: 5,
    flexDirection: 'row',
    flexWrap: 'wrap',
    // backgroundColor: 'rgba(0,0,0,0.2)'
    // justifyContent: 'center',
  },
  wySection: {
    paddingLeft: 15,
    paddingRight: 15,
    paddingTop: 10,
    paddingBottom: 10,
  },
  wySectionTitle: {
    marginBottom: 8,
    opacity: 0.6,
  },
  wyButtonsWrap: {
    flexDirection: 'row',
    gap: 10,
  },
  wyButton: {
    flex: 1,
    height: 36,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  separator: {
    height: 1,
    marginLeft: 15,
    marginRight: 15,
    marginTop: 5,
    marginBottom: 5,
  },
})
const MIN_WIDTH = scaleSizeW(150)
const PADDING = styles.list.paddingLeft + styles.list.paddingRight


const EditListItem = ({ itemWidth }: {
  itemWidth: number
}) => {
  const [isEdit, setEdit] = useState(false)
  const theme = useTheme()
  const t = useI18n()

  return (
    <View style={{ ...listStyles.listItem, width: itemWidth }}>
      <TouchableOpacity
        style={{ ...listStyles.button, borderColor: theme['c-primary-light-200-alpha-700'], borderStyle: 'dashed' }}
        onPress={() => { setEdit(true) }}
      >
        <Text style={{ opacity: isEdit ? 0 : 1 }} numberOfLines={1} size={14} color={theme['c-button-font']}>{t('list_create')}</Text>
      </TouchableOpacity>
      {
        isEdit
          ? <CreateUserList isEdit={isEdit} onHide={() => { setEdit(false) }} />
          : null
      }
    </View>
  )
}

const WySection = ({ musicInfo }: { musicInfo: LX.Music.MusicInfo }) => {
  const theme = useTheme()
  const t = useI18n()
  const pickerRef = useRef<WyPlaylistPickerType>(null)

  // 检查是否登录
  const isLoggedIn = !!settingState.setting['wy.musicUToken']

  // 写入链路异常的统一提示（NO_TOKEN/INVALID_TOKEN/其他）
  const showWriteError = (err: any) => {
    if (err?.code == 'NO_TOKEN') {
      toast(t('wy_playlist_token_empty'))
    } else if (err?.code == 'INVALID_TOKEN') {
      toast(t('wy_write_token_invalid'))
    } else {
      toast(t('wy_write_failed'))
    }
  }

  // 收藏到"我喜欢的音乐"
  const handleFavorite = async() => {
    if (!isLoggedIn) {
      toast(t('wy_write_token_invalid'))
      return
    }
    const trackIds = wyTrackIdsFromMusics([musicInfo])
    if (!trackIds.length) {
      toast(t('wy_write_only_wy'))
      return
    }
    try {
      const result = await favoriteToWyPlaylist(trackIds)
      toastWyWriteResult(result)
    } catch (err) {
      showWriteError(err)
    }
  }

  // 添加到指定歌单
  const handleAddToPlaylist = () => {
    if (!isLoggedIn) {
      toast(t('wy_write_token_invalid'))
      return
    }
    const trackIds = wyTrackIdsFromMusics([musicInfo])
    if (!trackIds.length) {
      toast(t('wy_write_only_wy'))
      return
    }
    pickerRef.current?.show(async(playlist) => {
      try {
        const result = await addTracksToWyPlaylist(playlist, trackIds)
        toastWyWriteResult(result)
      } catch (err) {
        showWriteError(err)
      }
    })
  }

  return (
    <>
      <View style={styles.wySection}>
        <Text size={12} style={styles.wySectionTitle}>{t('list_add_wy_section_title')}</Text>
        <View style={styles.wyButtonsWrap}>
          <TouchableOpacity
            style={{ ...styles.wyButton, backgroundColor: theme['c-button-background'], borderColor: theme['c-primary-light-400-alpha-300'] }}
            onPress={handleFavorite}
          >
            <Text size={13} color={theme['c-button-font']}>{t('list_add_wy_favorite')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{ ...styles.wyButton, backgroundColor: theme['c-button-background'], borderColor: theme['c-primary-light-400-alpha-300'] }}
            onPress={handleAddToPlaylist}
          >
            <Text size={13} color={theme['c-button-font']}>{t('list_add_wy_playlist')}</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={{ ...styles.separator, backgroundColor: theme['c-primary-light-200-alpha-400'] }} />
      <WyPlaylistPicker ref={pickerRef} />
    </>
  )
}

export default ({ musicInfo, onPress }: {
  musicInfo: LX.Music.MusicInfo
  onPress: (listInfo: LX.List.MyListInfo) => void
}) => {
  const windowSize = useWindowSize()
  const allList = useMyList()
  const itemWidth = useMemo(() => {
    let w = Math.floor(windowSize.width * 0.9 - PADDING)
    let n = Math.floor(w / MIN_WIDTH)
    if (n > 10) n = 10
    return Math.floor((w - 1) / n)
  }, [windowSize])

  return (
    <ScrollView style={{ flexGrow: 0 }}>
      <WySection musicInfo={musicInfo} />
      <View style={styles.list} onStartShouldSetResponder={() => true}>
        { allList.map(info => <ListItem key={info.id} listInfo={info} musicInfo={musicInfo} onPress={onPress} width={itemWidth} />) }
        <EditListItem itemWidth={itemWidth} />
      </View>
    </ScrollView>
  )
}

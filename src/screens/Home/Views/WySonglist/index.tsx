import { useEffect, useRef, useState } from 'react'
import { FlatList, RefreshControl, TouchableOpacity, View } from 'react-native'

import Button from '@/components/common/Button'
import Image from '@/components/common/Image'
import Loading from '@/components/common/Loading'
import Text from '@/components/common/Text'
import ChoosePath, { type ChoosePathType } from '@/components/common/ChoosePath'
import { LXM_FILE_EXT_RXP, NAV_SHEAR_NATIVE_IDS } from '@/config/constant'
import { createStyle, toast } from '@/utils/tools'
import { dateFormat } from '@/utils/common'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { useSettingValue } from '@/store/setting/hook'
import commonState, { type InitState as CommonState } from '@/store/common/state'
import { showWyLoginModal, showWyQrLoginModal } from '@/navigation/utils'
import { navigations } from '@/navigation'
import { log } from '@/utils/log'
import {
  getSnapshotMeta, saveSnapshot, checkAndAutoUpdate, exportSnapshot, importSnapshot,
  isSnapshotUpdating, type WySnapshotPlaylist,
} from '@/core/wySnapshot'

type Status = 'emptyToken' | 'loading' | 'list' | 'error' | 'emptySnapshot'

const ListItem = ({ item, onPress }: { item: WySnapshotPlaylist, onPress: (item: WySnapshotPlaylist) => void }) => {
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
  const [status, setStatus] = useState<Status>('loading')
  const [playlists, setPlaylists] = useState<WySnapshotPlaylist[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [updatedAt, setUpdatedAt] = useState(0)
  const choosePathRef = useRef<ChoosePathType>(null)
  const [choosePathAction, setChoosePathAction] = useState<'export' | 'import'>('export')

  // 加载本地快照（秒开，离线可用）
  const loadSnapshot = async() => {
    const meta = await getSnapshotMeta()
    if (meta?.playlists.length) {
      setPlaylists(meta.playlists)
      setUpdatedAt(meta.updatedAt)
      setStatus('list')
    } else if (!token) {
      setStatus('emptyToken')
    } else {
      setStatus('emptySnapshot')
    }
    return meta
  }

  // 在线更新（全量保存）
  const doUpdate = async(isRefresh = false) => {
    if (!token || isSnapshotUpdating()) return
    if (isRefresh) setRefreshing(true)
    setUpdating(true)
    toast(t('wy_snapshot_saving'))
    log.info('[WY 歌单页] 手动/自动更新歌单快照')
    try {
      const { playlists: saved, failed } = await saveSnapshot(token)
      setPlaylists(saved)
      setUpdatedAt(Date.now())
      setStatus('list')
      toast(t('wy_snapshot_saved', { num: saved.length - failed }))
    } catch (err) {
      log.warn(`[WY 歌单页] 更新失败: ${(err as Error).message}`)
      // 更新失败时保留旧数据展示
      const meta = await getSnapshotMeta()
      if (meta?.playlists.length) setStatus('list')
      else setStatus('error')
      toast(t('wy_snapshot_save_failed'))
    } finally {
      setUpdating(false)
      setRefreshing(false)
    }
  }

  // 进入页面：先加载快照，再按间隔检查自动更新
  useEffect(() => {
    void loadSnapshot().then(meta => {
      if (!token) return
      void checkAndAutoUpdate().then(({ updated, playlists: newList }) => {
        if (updated && newList) {
          setPlaylists(newList)
          setUpdatedAt(Date.now())
          setStatus('list')
          toast(t('wy_snapshot_auto_updated'))
        }
      })
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  // 再次进入本页面时刷新
  useEffect(() => {
    const handleNavIdUpdate = (id: CommonState['navActiveId']) => {
      if (id == 'nav_wy_songlist') {
        void loadSnapshot()
        if (token) {
          void checkAndAutoUpdate().then(({ updated, playlists: newList }) => {
            if (updated && newList) {
              setPlaylists(newList)
              setUpdatedAt(Date.now())
              setStatus('list')
            }
          })
        }
      }
    }
    global.state_event.on('navActiveIdUpdated', handleNavIdUpdate)
    return () => {
      global.state_event.off('navActiveIdUpdated', handleNavIdUpdate)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const handleUpdate = () => { void doUpdate(false) }
  const handleRefresh = () => { void doUpdate(true) }
  const handleRetry = () => { void doUpdate(false) }

  const handleExport = () => {
    setChoosePathAction('export')
    choosePathRef.current?.show({ title: t('wy_snapshot_export'), dirOnly: true })
  }
  const handleImport = () => {
    setChoosePathAction('import')
    choosePathRef.current?.show({ title: t('wy_snapshot_import'), dirOnly: false, filter: LXM_FILE_EXT_RXP })
  }
  const onConfirmPath = (path: string) => {
    if (choosePathAction == 'export') {
      void exportSnapshot(path).then(() => {
        toast(t('wy_snapshot_export_success'))
      }).catch((err: Error) => {
        toast(t('wy_snapshot_export_failed', { msg: err.message }))
      })
    } else {
      void importSnapshot(path).then((result) => {
        toast(t('wy_snapshot_import_result', { added: result.added, updated: result.updated, skipped: result.skipped }))
        void loadSnapshot()
      }).catch((err: Error) => {
        toast(t('wy_snapshot_import_failed', { msg: err.message }))
      })
    }
  }

  const handleOpen = (item: WySnapshotPlaylist) => {
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

  const handleOpenRecommend = () => {
    if (!commonState.componentIds.home) return
    navigations.pushWyRecommendScreen(commonState.componentIds.home)
  }

  const handleOpenRadio = () => {
    if (!commonState.componentIds.home) return
    navigations.pushWyRadioScreen(commonState.componentIds.home)
  }

  return (
    <View style={{ ...styles.container, backgroundColor: theme['c-content-background'] }}>
      <View style={styles.toolbar}>
        <Text size={11} style={styles.updatedAt} numberOfLines={1}>
          {updatedAt ? t('wy_snapshot_updated_at', { time: dateFormat(updatedAt, 'M-D h:m') }) : ''}
          {updating ? ` · ${t('wy_snapshot_updating')}` : ''}
        </Text>
        <View style={styles.toolbarBtns}>
          <TouchableOpacity style={styles.toolBtn} onPress={handleOpenRecommend}>
            <Text size={12} color={theme['c-primary-font']}>{t('wy_recommend_entry')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolBtn} onPress={handleOpenRadio}>
            <Text size={12} color={theme['c-primary-font']}>{t('wy_radio_entry')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolBtn} onPress={handleUpdate} disabled={updating}>
            <Text size={12} color={theme['c-primary-font']}>{t('wy_snapshot_update')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolBtn} onPress={handleExport}>
            <Text size={12} color={theme['c-primary-font']}>{t('wy_snapshot_export')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolBtn} onPress={handleImport}>
            <Text size={12} color={theme['c-primary-font']}>{t('wy_snapshot_import')}</Text>
          </TouchableOpacity>
        </View>
      </View>

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
        status == 'emptySnapshot'
          ? <View style={styles.center}>
              <Text size={13} style={styles.tipText}>{t('wy_snapshot_empty')}</Text>
              <View style={styles.btnRow}>
                <Button style={{ ...styles.smallBtn, backgroundColor: theme['c-button-background'] }} onPress={handleUpdate}>
                  <Text color={theme['c-button-font']}>{t('wy_snapshot_update')}</Text>
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

      <ChoosePath ref={choosePathRef} onConfirm={onConfirmPath} />
    </View>
  )
}

const styles = createStyle({
  container: {
    flex: 1,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 15,
    paddingRight: 15,
    paddingTop: 6,
    paddingBottom: 6,
  },
  updatedAt: {
    flexGrow: 1,
    flexShrink: 1,
    opacity: 0.55,
    marginRight: 10,
  },
  toolbarBtns: {
    flexDirection: 'row',
    flexShrink: 0,
  },
  toolBtn: {
    marginLeft: 15,
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

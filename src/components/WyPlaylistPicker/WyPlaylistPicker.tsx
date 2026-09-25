import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { View } from 'react-native'

import Dialog, { type DialogType } from '@/components/common/Dialog'
import Text from '@/components/common/Text'
import Button from '@/components/common/Button'
import Loading from '@/components/common/Loading'
import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { fetchUserPlaylists, type WyPlaylistItem } from '@/core/wyPlaylistWrite'
import { getSnapshotMeta } from '@/core/wySnapshot'

export interface WyPlaylistPickerType {
  show: (onPick: (playlist: WyPlaylistItem) => void) => void
}

export default forwardRef<WyPlaylistPickerType, {}>((props, ref) => {
  const theme = useTheme()
  const t = useI18n()
  const dialogRef = useRef<DialogType>(null)
  const onPickRef = useRef<(playlist: WyPlaylistItem) => void>(() => {})
  const [status, setStatus] = useState<'loading' | 'list' | 'empty' | 'error' | 'idle'>('idle')
  const [playlists, setPlaylists] = useState<WyPlaylistItem[]>([])

  const loadSnapshot = async(): Promise<WyPlaylistItem[]> => {
    try {
      const meta = await getSnapshotMeta()
      return meta?.playlists.map(item => ({
        id: item.id,
        name: item.name,
        trackCount: item.trackCount,
        author: item.author,
        img: item.img,
        specialType: item.specialType ?? 0,
      })) ?? []
    } catch {
      return []
    }
  }

  const load = () => {
    setStatus('loading')
    fetchUserPlaylists().then(async list => {
      const playlists = list.length ? list : await loadSnapshot()
      setPlaylists(playlists)
      setStatus(playlists.length ? 'list' : 'empty')
    }).catch(async() => {
      const fallback = await loadSnapshot()
      if (fallback.length) {
        setPlaylists(fallback)
        setStatus('list')
      } else {
        setStatus('error')
      }
    })
  }

  useImperativeHandle(ref, () => ({
    show(onPick) {
      onPickRef.current = onPick
      load()
      requestAnimationFrame(() => {
        dialogRef.current?.setVisible(true)
      })
    },
  }))

  useEffect(() => {
    // 组件级隐藏
  }, [])

  const handlePick = (playlist: WyPlaylistItem) => {
    dialogRef.current?.setVisible(false)
    onPickRef.current(playlist)
  }

  return (
    <Dialog ref={dialogRef}>
      <View style={styles.container}>
        <Text size={15} style={styles.title}>{t('wy_record_pick_title')}</Text>
        {
          status == 'loading'
            ? <View style={styles.center}><Loading /></View>
            : null
        }
        {
          status == 'error'
            ? <View style={styles.center}>
                <Text size={12} style={styles.tip}>{t('wy_record_pick_failed')}</Text>
                <Button style={{ ...styles.btn, backgroundColor: theme['c-button-background'] }} onPress={load}>
                  <Text color={theme['c-button-font']}>{t('wy_playlist_retry')}</Text>
                </Button>
              </View>
            : null
        }
        {
          status == 'empty'
            ? <View style={styles.center}>
                <Text size={12} style={styles.tip}>{t('wy_record_pick_empty')}</Text>
              </View>
            : null
        }
        {
          status == 'list'
            ? <View style={styles.listWrap}>
                {
                  playlists.map(playlist => (
                    <Button
                      key={playlist.id}
                      style={{ ...styles.item, borderBottomColor: theme['c-border-background'] }}
                      onPress={() => { handlePick(playlist) }}>
                      <Text size={13} numberOfLines={1} style={styles.itemName}>{playlist.name}</Text>
                      <Text size={11} style={styles.itemDesc} numberOfLines={1}>{playlist.trackCount} · {playlist.author}</Text>
                    </Button>
                  ))
                }
              </View>
            : null
        }
      </View>
    </Dialog>
  )
})

const styles = createStyle({
  container: {
    paddingLeft: 15,
    paddingRight: 15,
    paddingTop: 15,
    paddingBottom: 15,
    maxHeight: 320,
  },
  title: {
    textAlign: 'center',
    marginBottom: 10,
  },
  center: {
    alignItems: 'center',
    padding: 20,
  },
  tip: {
    opacity: 0.7,
    textAlign: 'center',
    marginBottom: 12,
  },
  btn: {
    paddingTop: 8,
    paddingBottom: 8,
    paddingLeft: 22,
    paddingRight: 22,
    borderRadius: 4,
  },
  listWrap: {
    flex: 1,
  },
  item: {
    paddingTop: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  itemName: {
    textAlign: 'left',
  },
  itemDesc: {
    opacity: 0.55,
    marginTop: 3,
    textAlign: 'left',
  },
})

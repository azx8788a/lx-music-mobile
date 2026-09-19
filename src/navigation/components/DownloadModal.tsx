import { useEffect, useMemo, useState } from 'react'
import { View, ScrollView, TouchableOpacity } from 'react-native'
import { Navigation } from 'react-native-navigation'

import Button from '@/components/common/Button'
import ModalContent from './ModalContent'
import Text from '@/components/common/Text'
import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang/index'
import { getOtherSource } from '@/core/music/utils'
import { state as downloadState } from '@/store/download/state'
import { createDownloadTask } from '@/core/download'
import { showDownloadManagerModal } from '@/navigation/utils'
import settingState from '@/store/setting/state'


const QUALITY_LIST: LX.Quality[] = ['128k', '192k', '320k', 'flac', 'flac24bit', 'ape', 'wav']

const Content = ({ componentId }: { componentId: string }) => {
  const theme = useTheme()
  const t = useI18n()

  const pickerInfo = downloadState.pickerInfo
  const [sourceInfos, setSourceInfos] = useState<LX.Music.MusicInfoOnline[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedSource, setSelectedSource] = useState('')
  const [selectedQuality, setSelectedQuality] = useState<LX.Quality>('320k')

  useEffect(() => {
    if (!pickerInfo) return
    const original = pickerInfo.musicInfo
    setSourceInfos([original])
    setSelectedSource(original.source)
    setSearching(true)
    let disposed = false
    getOtherSource(original).then(list => {
      if (disposed) return
      const unique = list.filter(m => !(m.source == original.source && m.id == original.id))
      setSourceInfos([original, ...unique])
      setSearching(false)
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    }).catch(() => {
      if (!disposed) setSearching(false)
    })
    return () => {
      disposed = true
    }
  }, [pickerInfo])

  const qualities = useMemo(() => {
    if (!selectedSource) return []
    return QUALITY_LIST.filter(q => (global.lx.qualityList[selectedSource as LX.Source] ?? []).includes(q))
  }, [selectedSource])

  useEffect(() => {
    if (selectedSource) {
      const supported = QUALITY_LIST.filter(q => (global.lx.qualityList[selectedSource as LX.Source] ?? []).includes(q))
      setSelectedQuality(supported.includes(settingState.setting['download.quality'])
        ? settingState.setting['download.quality']
        : supported[0] ?? '320k')
    }
  }, [selectedSource])

  const selectedInfo = sourceInfos.find(s => s.source == selectedSource) ?? null

  const handleCancel = () => {
    void Navigation.dismissOverlay(componentId)
  }

  const handleConfirm = () => {
    if (!selectedInfo) return
    void createDownloadTask({ musicInfo: selectedInfo, quality: selectedQuality })
    void Navigation.dismissOverlay(componentId).then(() => {
      setTimeout(() => {
        showDownloadManagerModal()
      }, 200)
    })
  }

  if (!pickerInfo) return null

  return (
    <ModalContent>
      <View style={styles.main}>
        <Text style={styles.title} size={18}>{t('download')}</Text>
        <Text style={styles.songName} size={14} numberOfLines={1}>{pickerInfo.musicInfo.name}</Text>
        <Text style={styles.sectionTitle} size={13}>{t('download_select_source')}</Text>
        <ScrollView style={styles.content} keyboardShouldPersistTaps={'always'}>
          {
            sourceInfos.map((info, index) => {
              const isSelected = info.source == selectedSource
              const sourceName = t(`source_alias_${info.source}`)
              return (
                <TouchableOpacity key={`${info.source}_${info.id}_${index}`} style={styles.row} activeOpacity={0.6} onPress={() => { setSelectedSource(info.source) }}>
                  <Text style={isSelected ? { ...styles.rowText, color: theme['c-primary-font'] } : styles.rowText} size={13} numberOfLines={1}>
                    {sourceName} · {info.name} - {info.singer}
                  </Text>
                  {isSelected ? <Text style={{ ...styles.checkIcon, color: theme['c-primary-font'] }} size={13}>✓</Text> : null}
                </TouchableOpacity>
              )
            })
          }
          {searching ? <Text style={styles.loading} size={12}>{t('download_find_source')}</Text> : null}
        </ScrollView>
        <Text style={styles.sectionTitle} size={13}>{t('download_select_quality')}</Text>
        <View style={styles.qualityList}>
          {
            qualities.map(q => {
              const isSelected = q == selectedQuality
              return (
                <TouchableOpacity key={q} style={isSelected ? { ...styles.qualityItem, ...styles.qualityItemSelected } : styles.qualityItem} activeOpacity={0.6} onPress={() => { setSelectedQuality(q) }}>
                  <Text color={isSelected ? theme['c-primary-font'] : theme['c-300']} size={13}>{q}</Text>
                </TouchableOpacity>
              )
            })
          }
          {qualities.length == 0 ? <Text style={styles.loading} size={12}>{t('download_no_quality')}</Text> : null}
        </View>
      </View>
      <View style={styles.btns}>
        <Button style={{ ...styles.btn, backgroundColor: theme['c-button-background'] }} onPress={handleCancel}>
          <Text color={theme['c-button-font']}>{t('cancel')}</Text>
        </Button>
        <Button disabled={!selectedInfo || qualities.length == 0} style={{ ...styles.btn, backgroundColor: theme['c-button-background'] }} onPress={handleConfirm}>
          <Text color={theme['c-button-font']}>{t('confirm_button_text')}</Text>
        </Button>
      </View>
    </ModalContent>
  )
}

const DownloadModal = ({ componentId }: { componentId: string }) => {
  if (!downloadState.pickerInfo) return null
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
    marginBottom: 5,
  },
  songName: {
    textAlign: 'center',
    marginBottom: 10,
    paddingLeft: 15,
    paddingRight: 15,
  },
  sectionTitle: {
    paddingLeft: 15,
    marginBottom: 5,
  },
  content: {
    flexGrow: 0,
    flexShrink: 1,
    paddingLeft: 15,
    paddingRight: 15,
    maxHeight: 170,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 8,
  },
  rowText: {
    flexShrink: 1,
  },
  checkIcon: {
    marginLeft: 10,
  },
  loading: {
    opacity: 0.6,
    paddingTop: 5,
    paddingBottom: 5,
  },
  qualityList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingLeft: 15,
    paddingRight: 15,
  },
  qualityItem: {
    paddingTop: 6,
    paddingBottom: 6,
    paddingLeft: 10,
    paddingRight: 10,
    borderRadius: 4,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.4)',
  },
  qualityItemSelected: {
    borderColor: 'rgba(7,197,86,0.8)',
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

export default DownloadModal

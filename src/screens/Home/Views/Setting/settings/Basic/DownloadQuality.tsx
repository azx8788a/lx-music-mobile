import { memo, useMemo } from 'react'

import { StyleSheet, View } from 'react-native'

import SubTitle from '../../components/SubTitle'
import CheckBox from '@/components/common/CheckBox'
import { useSettingValue } from '@/store/setting/hook'
import { useI18n } from '@/lang'
import { updateSetting } from '@/core/common'

type DownloadQuality = LX.Quality

const setDownloadQuality = (quality: DownloadQuality) => {
  updateSetting({ 'download.quality': quality })
}


const useActive = (quality: DownloadQuality) => {
  const downloadQuality = useSettingValue('download.quality')
  const isActive = useMemo(() => downloadQuality == quality, [downloadQuality, quality])
  return isActive
}

const Item = ({ id }: {
  id: DownloadQuality
}) => {
  const isActive = useActive(id)
  return <CheckBox marginBottom={3} check={isActive} label={id} onChange={() => { setDownloadQuality(id) }} need />
}

export default memo(() => {
  const t = useI18n()
  const list = useMemo(() => {
    return [{ id: '128k' }, { id: '320k' }, { id: 'flac' }, { id: 'flac24bit' }] as const
  }, [])

  return (
    <SubTitle title={t('setting_basic_download_quality')}>
      <View style={styles.list}>
        {
          list.map(({ id }) => <Item id={id} key={id} />)
        }
      </View>
    </SubTitle>
  )
})

const styles = StyleSheet.create({
  list: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
})

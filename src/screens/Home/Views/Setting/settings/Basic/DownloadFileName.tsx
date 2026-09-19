import { memo, useMemo } from 'react'

import { StyleSheet, View } from 'react-native'

import SubTitle from '../../components/SubTitle'
import CheckBox from '@/components/common/CheckBox'
import { useSettingValue } from '@/store/setting/hook'
import { useI18n } from '@/lang'
import { updateSetting } from '@/core/common'

type DownloadFileName = LX.AppSetting['download.fileName']

const setDownloadFileName = (fileName: DownloadFileName) => {
  updateSetting({ 'download.fileName': fileName })
}


const useActive = (fileName: DownloadFileName) => {
  const downloadFileName = useSettingValue('download.fileName')
  const isActive = useMemo(() => downloadFileName == fileName, [downloadFileName, fileName])
  return isActive
}

const Item = ({ id }: {
  id: DownloadFileName
}) => {
  const isActive = useActive(id)
  return <CheckBox marginBottom={3} check={isActive} label={id} onChange={() => { setDownloadFileName(id) }} need />
}

export default memo(() => {
  const t = useI18n()
  const list = useMemo(() => {
    return [{ id: '歌名 - 歌手' }, { id: '歌手 - 歌名' }, { id: '歌名' }] as const
  }, [])

  return (
    <SubTitle title={t('setting_basic_download_file_name')}>
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

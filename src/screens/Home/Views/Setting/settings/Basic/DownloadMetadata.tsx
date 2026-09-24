import { memo } from 'react'

import SubTitle from '../../components/SubTitle'
import CheckBoxItem from '../../components/CheckBoxItem'
import { useSettingValue } from '@/store/setting/hook'
import { useI18n } from '@/lang'
import { updateSetting } from '@/core/common'

export default memo(() => {
  const t = useI18n()
  const isWriteMetadata = useSettingValue('download.isWriteMetadata')
  const isSaveLyric = useSettingValue('download.isSaveLyric')

  const setWriteMetadata = (value: boolean) => {
    updateSetting({ 'download.isWriteMetadata': value })
  }
  const setSaveLyric = (value: boolean) => {
    updateSetting({ 'download.isSaveLyric': value })
  }

  return (
    <SubTitle title={t('setting_basic_download_metadata')}>
      <CheckBoxItem check={isWriteMetadata} label={t('setting_basic_download_metadata_tag')} onChange={setWriteMetadata} />
      <CheckBoxItem check={isSaveLyric} label={t('setting_basic_download_metadata_lyric')} onChange={setSaveLyric} />
    </SubTitle>
  )
})

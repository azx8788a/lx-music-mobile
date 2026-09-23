import { memo, useRef, useState } from 'react'
import { StyleSheet, TouchableOpacity, View } from 'react-native'

import SubTitle from '../../components/SubTitle'
import Text from '@/components/common/Text'
import ChoosePath, { type ChoosePathType } from '@/components/common/ChoosePath'
import { useSettingValue } from '@/store/setting/hook'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { updateSetting } from '@/core/common'
import { externalStorageDirectoryPath } from '@/utils/fs'
import { showStoragePermissionDialog } from '@/utils/storagePermission'
import { toast } from '@/utils/tools'


export default memo(() => {
  const t = useI18n()
  const theme = useTheme()
  const savePath = useSettingValue('download.savePath')
  const [visible, setVisible] = useState(false)
  const choosePathRef = useRef<ChoosePathType>(null)

  const handleShowChoosePath = () => {
    if (visible) {
      choosePathRef.current?.show({ title: t('setting_basic_download_save_path'), dirOnly: true })
    } else {
      setVisible(true)
      requestAnimationFrame(() => {
        choosePathRef.current?.show({ title: t('setting_basic_download_save_path'), dirOnly: true })
      })
    }
  }

  // 手动触发存储授权（写入公共目录所需的读写权限）
  const handleRequestPermission = () => {
    void showStoragePermissionDialog().then(granted => {
      if (granted) toast(t('setting_basic_download_permission_granted'))
    })
  }

  return (
    <SubTitle title={t('setting_basic_download_save_path')}>
      <View style={styles.content}>
        <TouchableOpacity onPress={handleShowChoosePath}>
          <Text numberOfLines={1} color={theme['c-primary-font']}>
            {savePath || `${externalStorageDirectoryPath}/Music`}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.permissionLink} onPress={handleRequestPermission}>
          <Text size={12} style={styles.permissionText}>{t('setting_basic_download_permission_check')}</Text>
        </TouchableOpacity>
        { visible ? <ChoosePath ref={choosePathRef} onConfirm={path => { updateSetting({ 'download.savePath': path }) }} /> : null }
      </View>
    </SubTitle>
  )
})

const styles = StyleSheet.create({
  content: {
    paddingTop: 5,
    paddingBottom: 5,
  },
  permissionLink: {
    marginTop: 8,
  },
  permissionText: {
    opacity: 0.7,
  },
})

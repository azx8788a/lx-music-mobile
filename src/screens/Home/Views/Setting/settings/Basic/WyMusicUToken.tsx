import { memo, useRef, useState } from 'react'
import { StyleSheet, View, TouchableOpacity } from 'react-native'

import SubTitle from '../../components/SubTitle'
import Text from '@/components/common/Text'
import Input from '@/components/common/Input'
import Button from '@/components/common/Button'
import Dialog, { type DialogType } from '@/components/common/Dialog'
import { useSettingValue } from '@/store/setting/hook'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { updateSetting } from '@/core/common'


export default memo(() => {
  const t = useI18n()
  const theme = useTheme()
  const token = useSettingValue('wy.musicUToken')
  const [text, setText] = useState('')
  const dialogRef = useRef<DialogType>(null)

  const handleShowEdit = () => {
    setText(token)
    dialogRef.current?.setVisible(true)
  }
  const handleConfirm = () => {
    dialogRef.current?.setVisible(false)
    updateSetting({ 'wy.musicUToken': text.trim() })
  }
  const handleClear = () => {
    updateSetting({ 'wy.musicUToken': '' })
  }

  return (
    <>
      <SubTitle title={t('setting_basic_wy_musicutoken')}>
        <View style={styles.row}>
          <TouchableOpacity style={styles.valueBtn} onPress={handleShowEdit}>
            <Text color={theme['c-primary-font']} numberOfLines={1} style={styles.value}>
              {token ? t('setting_basic_wy_musicutoken_saved') : t('setting_basic_wy_musicutoken_not_set')}
            </Text>
          </TouchableOpacity>
          {token
            ? <TouchableOpacity onPress={handleClear}>
                <Text style={{ opacity: 0.7 }}>{t('setting_basic_wy_musicutoken_clear')}</Text>
              </TouchableOpacity>
            : null}
        </View>
        <Text size={11} style={styles.hint}>{t('setting_basic_wy_musicutoken_tip')}</Text>
      </SubTitle>
      <Dialog ref={dialogRef} title={t('setting_basic_wy_musicutoken')}>
        <View style={styles.dialogContent}>
          <View style={styles.inputWrap}>
            <Input placeholder="MUSIC_U" value={text} onChangeText={setText} />
          </View>
          <View style={styles.dialogBtns}>
            <Button style={{ ...styles.btn, backgroundColor: theme['c-button-background'] }} onPress={() => dialogRef.current?.setVisible(false)}>
              <Text color={theme['c-button-font']}>{t('cancel')}</Text>
            </Button>
            <Button style={{ ...styles.btn, ...styles.btnLast, backgroundColor: theme['c-button-background'] }} onPress={handleConfirm}>
              <Text color={theme['c-button-font']}>{t('confirm_button_text')}</Text>
            </Button>
          </View>
        </View>
      </Dialog>
    </>
  )
})

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 5,
    paddingBottom: 5,
  },
  valueBtn: {
    flexGrow: 1,
    flexShrink: 1,
  },
  value: {
    marginRight: 10,
  },
  hint: {
    opacity: 0.6,
    lineHeight: 16,
  },
  dialogContent: {
    padding: 15,
  },
  inputWrap: {
    marginBottom: 15,
  },
  dialogBtns: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  btn: {
    flex: 1,
    paddingTop: 10,
    paddingBottom: 10,
    alignItems: 'center',
    borderRadius: 4,
    marginRight: 15,
  },
  btnLast: {
    marginRight: 0,
  },
})

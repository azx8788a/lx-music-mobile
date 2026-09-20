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
import { showWyLoginModal, showWyQrLoginModal } from '@/navigation/utils'
import { log } from '@/utils/log'

const getUserNickname = (userInfo: string) => {
  if (!userInfo) return ''
  try {
    const info = JSON.parse(userInfo) as { nickname?: string }
    return info.nickname ?? ''
  } catch {
    return ''
  }
}

export default memo(() => {
  const t = useI18n()
  const theme = useTheme()
  const token = useSettingValue('wy.musicUToken')
  const userInfo = useSettingValue('wy.userInfo')
  const [text, setText] = useState('')
  const dialogRef = useRef<DialogType>(null)
  const nickname = getUserNickname(userInfo)

  const handleShowEdit = () => {
    setText(token)
    dialogRef.current?.setVisible(true)
  }
  const handleConfirm = () => {
    dialogRef.current?.setVisible(false)
    const value = text.trim()
    updateSetting({ 'wy.musicUToken': value })
    log.info(`[WY] 手动保存登录 Token（长度: ${value.length}）`)
  }
  const handleLogout = () => {
    updateSetting({ 'wy.musicUToken': '', 'wy.userInfo': '' })
    log.info('[WY] 已退出网易云登录')
  }

  return (
    <>
      <SubTitle title={t('setting_basic_wy_musicutoken')}>
        <View style={styles.row}>
          <Text style={styles.value} numberOfLines={1}>
            {token
              ? (nickname ? t('setting_basic_wy_musicu_logged_in', { name: nickname }) : t('setting_basic_wy_musicu_logged_in_fallback'))
              : t('setting_basic_wy_musicu_not_logged_in')}
          </Text>
          <TouchableOpacity onPress={showWyLoginModal}>
            <Text color={theme['c-primary-font']}>
              {token ? t('setting_basic_wy_musicu_relogin') : t('setting_basic_wy_musicu_web_login')}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.linkRow}>
          <TouchableOpacity style={styles.link} onPress={showWyQrLoginModal}>
            <Text size={12} style={styles.linkText}>{t('setting_basic_wy_musicu_qr_login')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.link} onPress={handleShowEdit}>
            <Text size={12} style={styles.linkText}>{t('setting_basic_wy_musicu_manual_edit')}</Text>
          </TouchableOpacity>
          {token
            ? <TouchableOpacity style={styles.link} onPress={handleLogout}>
                <Text size={12} style={styles.linkText}>{t('setting_basic_wy_musicu_logout')}</Text>
              </TouchableOpacity>
            : null}
        </View>
        <Text size={11} style={styles.hint}>{t('setting_basic_wy_musicutoken_tip')}</Text>
      </SubTitle>
      <Dialog ref={dialogRef} title={t('setting_basic_wy_musicu_dialog_title')}>
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
  value: {
    flexGrow: 1,
    flexShrink: 1,
    marginRight: 10,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 5,
  },
  link: {
    marginRight: 20,
  },
  linkText: {
    opacity: 0.7,
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

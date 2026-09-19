import { useMemo, useState, useEffect } from 'react'
import { View, ScrollView, Alert } from 'react-native'
import { Navigation } from 'react-native-navigation'

import Button from '@/components/common/Button'
import { createStyle, openUrl } from '@/utils/tools'
import { useSettingValue } from '@/store/setting/hook'
import { useTheme } from '@/store/theme/hook'
import Text from '@/components/common/Text'
import ModalContent from './ModalContent'
import { exitApp } from '@/utils/nativeModules/utils'
import { updateSetting } from '@/core/common'
import { checkUpdate } from '@/core/version'
import { initDeeplink } from '@/core/init/deeplink'


const Content = () => {
  const theme = useTheme()

  const openHomePage = () => {
    void openUrl('https://github.com/lyswhut/lx-music-mobile')
  }

  const textLinkStyle = {
    ...styles.text,
    textDecorationLine: 'underline',
    color: theme['c-primary-font'],
  } as const

  return (
    <View style={styles.main}>
      <Text style={styles.title} size={18} >修改版公告</Text>
      <ScrollView style={styles.content} keyboardShouldPersistTaps={'always'}>
        <Text selectable style={styles.text} >在使用本应用前，请先阅读本公告。点击下方「同意并进入」即表示你已阅读并同意以下内容。{'\n'}</Text>
        <Text style={styles.bold} >一、本应用是什么{'\n'}</Text>
        <Text selectable style={styles.text} >本应用是基于开源项目 <Text onPress={openHomePage} style={textLinkStyle}>LX Music（洛雪音乐）移动版</Text> v1.9.1 源码构建的第三方修改版，与原版项目及其作者无任何关联，非官方发布版本。{'\n'}</Text>
        <Text style={styles.bold} >二、相对原版修改了什么{'\n'}</Text>
        <Text selectable style={styles.text} >1. 内置 23 个第三方音乐源：安装后自动导入，并在「自定义源」中默认选中一个多平台聚合源，开箱即用；音源失效后可在「设置 → 自定义源」中手动导入或切换其他音源。{'\n'}</Text>
        <Text selectable style={styles.text} >2. 新增音乐下载功能：下载歌曲时可选择音源与音质（自动搜索同一首歌在其他平台的版本），支持批量下载、断链自动换源、暂停/继续/重试；可在「我的列表页面右上角下载图标」中查看与管理下载任务。{'\n'}</Text>
        <Text selectable style={styles.text} >3. 新增下载相关设置：保存路径、默认音质、文件命名方式，位于「设置 → 基础设置」。{'\n'}</Text>
        <Text style={styles.bold} >三、关于内置音源的免责声明{'\n'}</Text>
        <Text selectable style={styles.text} >内置音源均收集自公开渠道，不对其可用性、安全性作任何保证；音源脚本权利归属各自作者，如需最新版本请自行联系对应作者。{'\n'}</Text>
        <Text style={styles.bold} >四、版权与免费声明{'\n'}</Text>
        <Text selectable style={styles.text} >版权相关约定请遵守原版许可协议。下载的版权数据请在 24 小时内删除，请支持正版。{'\n'}</Text>
        <Text selectable style={styles.text} >本应用完全免费且开源，未授权任何第三方渠道付费售卖。如果你是通过花钱购买的方式获得本应用，请立即申请退款并给差评！{'\n'}</Text>
      </ScrollView>
    </View>
  )
}

const Footer = ({ componentId }: { componentId: string }) => {
  const theme = useTheme()
  const isAgreeModNotice = useSettingValue('common.isAgreeModNotice')
  const [time, setTime] = useState(10)

  const handleReject = () => {
    exitApp()
  }

  const handleConfirm = () => {
    let _isAgreeModNotice = isAgreeModNotice
    if (!isAgreeModNotice) updateSetting({ 'common.isAgreeModNotice': true })
    void Navigation.dismissOverlay(componentId)
    if (!_isAgreeModNotice) {
      setTimeout(() => {
        Alert.alert(
          '',
          Buffer.from('e69cace8bdafe4bbb6e5ae8ce585a8e5858de8b4b9e4b894e5bc80e6ba90efbc8ce5a682e69e9ce4bda0e698afe88ab1e992b1e8b4ade4b9b0e79a84efbc8ce8afb7e79bb4e68ea5e7bb99e5b7aee8af84efbc810a0a5468697320736f667477617265206973206672656520616e64206f70656e20736f757263652e', 'hex').toString(),
          [{
            text: Buffer.from('e5a5bde79a8420284f4b29', 'hex').toString(),
            onPress: () => {
              void checkUpdate()
              void initDeeplink()
            },
          }],
        )
      }, 2e3)
    }
  }

  const confirmBtn = useMemo(() => {
    return time ? { disabled: true, text: `同意并进入（${time}）` } : { disabled: false, text: '同意并进入' }
  }, [time])

  useEffect(() => {
    const timeoutTools = {
      timeout: null as NodeJS.Timeout | null,
      start() {
        this.timeout = setTimeout(() => {
          setTime(time => {
            time--
            if (time > 0) this.start()
            return time
          })
        }, 1000)
      },
      clear() {
        if (!this.timeout) return
        clearTimeout(this.timeout)
      },
    }
    timeoutTools.start()
    return () => {
      timeoutTools.clear()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <Text selectable style={styles.tip} size={13}>本公告仅影响你的首次使用体验；同意后可在「设置 → 关于」中再次查看相关许可协议。</Text>
      <View style={styles.btns}>
        <Button style={{ ...styles.btn, backgroundColor: theme['c-button-background'] }} onPress={handleReject}>
          <Text color={theme['c-button-font']}>不同意</Text>
        </Button>
        <Button disabled={confirmBtn.disabled} style={{ ...styles.btn, backgroundColor: theme['c-button-background'] }} onPress={handleConfirm}>
          <Text color={theme['c-button-font']}>{confirmBtn.text}</Text>
        </Button>
      </View>
    </>
  )
}

const ModNoticeModal = ({ componentId }: { componentId: string }) => {
  return (
    <ModalContent>
      <Content />
      <Footer componentId={componentId} />
    </ModalContent>
  )
}

const styles = createStyle({
  main: {
    flexShrink: 1,
    marginTop: 15,
    marginBottom: 10,
  },
  content: {
    flexGrow: 0,
    marginLeft: 5,
    marginRight: 5,
    paddingLeft: 10,
    paddingRight: 10,
  },
  title: {
    textAlign: 'center',
    marginBottom: 15,
  },
  text: {
    fontSize: 14,
    textAlignVertical: 'bottom',
    marginBottom: 5,
  },
  bold: {
    fontSize: 14,
    textAlignVertical: 'bottom',
    fontWeight: 'bold',
  },
  tip: {
    textAlignVertical: 'bottom',
    fontWeight: 'bold',
    paddingLeft: 15,
    paddingRight: 15,
    paddingBottom: 15,
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

export default ModNoticeModal

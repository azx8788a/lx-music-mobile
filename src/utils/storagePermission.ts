import { AppState, Linking, PermissionsAndroid, Platform } from 'react-native'

import { confirmDialog, isAndroid, toast } from '@/utils/tools'
import { writeFile, unlink } from '@/utils/fs'
import { log } from '@/utils/log'

type StoragePermissionResult = 'granted' | 'denied' | 'blocked'

const WRITE = PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE
const READ = PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE

// 已永久拒绝（勾选不再询问后系统不再弹窗）
const isBlocked = (s?: string) => s === 'never_ask_again' || s === 'blocked'

/**
 * 检查并申请存储权限（三态：granted / denied / blocked）
 * @returns 'granted' 已授权；'denied' 本次拒绝；'blocked' 永久拒绝（需跳系统设置）
 */
export const ensureStoragePermission = async(): Promise<StoragePermissionResult> => {
  if (!isAndroid) return 'granted'
  try {
    if (await PermissionsAndroid.check(WRITE)) return 'granted'
    const result = await PermissionsAndroid.requestMultiple([WRITE, READ])
    const state = result[WRITE]
    log.info(`[下载] 存储权限申请结果: ${String(state)}`)
    if (state === PermissionsAndroid.RESULTS.GRANTED) return 'granted'
    return isBlocked(state) ? 'blocked' : 'denied'
  } catch (err) {
    log.warn(`[下载] 存储权限申请异常: ${(err as Error).message}`)
    return 'denied'
  }
}

/**
 * 弹出存储权限授权引导窗口（用户主动授权写公共目录）
 * - denied：应用内说明后重新发起系统弹窗
 * - blocked：引导跳转系统设置，返回后自动复查
 * @returns 授权成功 resolve true
 */
export const showStoragePermissionDialog = async(): Promise<boolean> => {
  const state = await ensureStoragePermission()
  if (state === 'granted') return true

  const confirmed = await confirmDialog({
    message: state === 'blocked'
      ? global.i18n.t('storage_permission_tip_disagree_ask_again')
      : global.i18n.t('storage_permission_tip_request'),
    confirmButtonText: state === 'blocked' ? global.i18n.t('agree_to') : global.i18n.t('confirm_button_text'),
    cancelButtonText: global.i18n.t('cancel'),
    bgClose: false,
  })
  if (!confirmed) {
    toast(global.i18n.t('storage_permission_tip_disagree'))
    return false
  }

  if (state === 'blocked') {
    // 永久拒绝：跳系统设置页，等待用户返回前台后复查权限
    await Linking.openSettings()
    const granted = await new Promise<boolean>(resolve => {
      let done = false
      const finish = (result: boolean) => {
        if (done) return
        done = true
        resolve(result)
      }
      const subscription = AppState.addEventListener('change', (s) => {
        if (s !== 'active') return
        subscription.remove()
        setTimeout(() => {
          void PermissionsAndroid.check(WRITE).then(finish)
        }, 500)
      })
      // 兜底：3 分钟后强制做一次检查，避免用户未返回时永远挂起
      setTimeout(() => {
        subscription.remove()
        void PermissionsAndroid.check(WRITE).then(finish)
      }, 3 * 60_000)
    })
    log.info(`[下载] 从系统设置返回，存储权限复查: ${String(granted)}`)
    if (!granted) {
      toast(global.i18n.t('storage_permission_tip_disagree'))
      return false
    }
    return true
  }

  // 本次拒绝：再次检查（若用户已勾选不再询问，将被识别为 blocked，下次进入引导页）
  const retry = await ensureStoragePermission()
  return retry === 'granted'
}

/**
 * 写入探针：向目标目录写一个小文件验证真实可写性（mkdir/exists 通过也可能实际不可写）
 * @returns 可写返回 true
 */
export const testDirWritable = async(dir: string): Promise<boolean> => {
  const probePath = `${dir}/.lx_probe_${Date.now()}`
  try {
    await writeFile(probePath, 'probe')
    await unlink(probePath).catch(() => {})
    return true
  } catch (err) {
    log.warn(`[下载] 目录写入探针失败：${dir}（${(err as Error).message}）`)
    return false
  }
}

/**
 * 收集存储诊断信息（写入错误日志，用于排查国产 ROM 二级权限墙等问题）
 */
export const collectStorageDiagnostics = async(): Promise<string> => {
  const lines: string[] = []
  try {
    const p = Platform as unknown as { constants: Record<string, unknown>, Version: number | string }
    lines.push(`Platform.Version: ${String(p.Version)}`)
    lines.push(`Brand: ${String(p.constants.Brand ?? '-')} / Model: ${String(p.constants.Model ?? '-')} / Manufacturer: ${String(p.constants.Manufacturer ?? '-')}`)
    const writeGranted = await PermissionsAndroid.check(WRITE).catch(() => false)
    const readGranted = await PermissionsAndroid.check(READ).catch(() => false)
    lines.push(`WRITE_EXTERNAL_STORAGE: ${String(writeGranted)} / READ_EXTERNAL_STORAGE: ${String(readGranted)}`)
  } catch (err) {
    lines.push(`collect error: ${(err as Error).message}`)
  }
  return lines.join('\n')
}

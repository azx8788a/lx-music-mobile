import builtinUserApiScripts from '@/config/builtinUserApi'
import { getData, saveData } from '@/plugins/storage'
import { storageDataPrefix } from '@/config/constant'
import { importUserApi, setUserApiAllowShowUpdateAlert } from '@/core/userApi'
import { bootLog } from '@/utils/bootLog'


/**
 * 首次启动导入内置音源，返回第一个成功导入的音源 id（用于默认选中）
 */
export default async(): Promise<string | null> => {
  if (await getData(storageDataPrefix.userApiBuiltinImported)) return null
  bootLog('Importing builtin user api...')
  let firstId: string | null = null
  for (const script of builtinUserApiScripts) {
    try {
      const info = await importUserApi(script)
      // 内置音源不弹更新提示，避免首启弹窗轰炸
      await setUserApiAllowShowUpdateAlert(info.id, false)
      firstId ??= info.id
    } catch (err: any) {
      bootLog(`Builtin user api import failed: ${err.message as string}`)
    }
  }
  await saveData(storageDataPrefix.userApiBuiltinImported, true)
  bootLog(`Builtin user api imported (${firstId ?? 'none'}).`)
  return firstId
}

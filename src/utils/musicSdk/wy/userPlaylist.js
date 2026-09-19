// https://github.com/Binaryify/NeteaseCloudMusicApi/blob/master/module/login_status.js
// https://github.com/Binaryify/NeteaseCloudMusicApi/blob/master/module/user_playlist.js
import { weapi } from './utils/crypto'
import { httpFetch } from '../../request'


const successCode = 200

const request = (path, data, token) => {
  const requestObj = httpFetch(`https://music.163.com${path}`, {
    method: 'post',
    format: 'json',
    headers: {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.90 Safari/537.36',
      Referer: 'https://music.163.com',
      Cookie: `MUSIC_U=${token}`,
    },
    // cache: 'default',
    form: weapi(data),
    timeout: 10_000,
  })
  return requestObj.promise
}

const retryOnFail = (handler, tryNum = 0) => {
  if (tryNum > 2) return Promise.reject(new Error('try max num'))
  return handler(tryNum + 1).catch(err => {
    console.log('retry', err.message)
    return retryOnFail(handler, tryNum + 1)
  })
}

/**
 * 获取登录态信息（含 uid）
 */
export const getLoginStatus = async(token) => {
  const { statusCode, body } = await retryOnFail(() => request('/weapi/login/status', { csrf_token: '' }, token))
  if (statusCode !== 200) throw new Error(`请求失败 (code: ${statusCode})`)
  if (body.code !== successCode) throw new Error(body.message ?? '登录状态获取失败')
  const profile = body.data?.profile ?? body.profile
  if (!profile?.userId) throw new Error('未获取到用户信息')
  return profile
}

/**
 * 获取用户的歌单列表（创建的 + 收藏的）
 */
export const getUserPlaylistList = async({ uid, token }) => {
  const { statusCode, body } = await retryOnFail(() => request('/weapi/user/playlist', { uid, offset: 0, limit: 1000, includeVideo: 'true' }, token))
  if (statusCode !== 200) throw new Error(`请求失败 (code: ${statusCode})`)
  if (body.code !== successCode) throw new Error(body.message ?? '歌单列表获取失败')
  return body.playlist
}

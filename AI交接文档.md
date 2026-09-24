# LX Music 修改版 — AI 交接文档 v2

> **写给下一个 AI 模型。读完这一份，你应该能立即接手开发、修改代码、打包发布。**
> 最后更新：2026-09-23
> 当前版本：v1.9.7

---

## 1. 项目速览

| 项 | 值 |
|---|---|
| 仓库 | `https://github.com/azx8788a/lx-music-mobile` |
| 账号 | `azx8788a`，GitHub Token: `<TOKEN_PLACEHOLDER>` |
| 工作区 | `/workspace/lx-music-mobile`（node_modules 已装好） |
| 上游 | `lyswhut/lx-music-mobile` v1.9.1（commit `fb84807`），我们是 fork |
| 框架 | React Native 0.73 + TypeScript + React Native Navigation |
| Android | targetSdk 29 / compileSdk 36 / minSdk 21 |
| 包名 | `cn.toside.music.mobile` |
| 构建 | GitHub Actions（push master 自动触发），产 5 套 ABI APK |
| 签名 | `/workspace/_keystore/net.lvtao.tool.keystore`（Secrets 已配好） |

---

## 2. 我们的改动（领先上游的 15+ 个提交）

按实现顺序：

### 2.1 内置 23 个音源
- `src/config/builtinUserApi/`：23 个 `.ts` + `index.ts`（由 `V260917.zip` 用 python 生成，文件头带 `/* eslint-disable */`）
- `src/core/init/userApi/builtin.ts`：首启自动导入，标记 `userApiBuiltinImported` 防重复

### 2.2 音乐下载功能（重要）
- **核心**：`src/core/download/index.ts`（约 400 行）
  - 串行队列（**不要加并发**，公益音源限流）
  - 流程：`getMusicUrl()` → 创建保存目录 → `RNFS.downloadFile()` 写到 `.dlpart` → `moveFile` → 完成
  - 任务持久化到 `@download_task_list`，重启恢复
- **错误码**：`DL_URL_001` / `DL_HTTP_001` / `DL_NET_001` / `DL_FS_001~003`，写入任务 `errorCode/errorPhase` 字段
- **日志**：前缀 `[下载]`，写入 `@/utils/log`（设置→其他→错误日志可查），不记录完整音乐 URL
- **权限**：`src/utils/storagePermission.ts`（三态 `granted/denied/blocked` + 授权窗口 + 写探针）
- Store：`src/store/download/`（state/action/event/hook）
- UI：`DownloadModal` / `DownloadManagerModal` / 歌曲菜单下载入口（`OnlineList/ListMenu.tsx`、`Mylist/MusicList/ListMenu.tsx`）
- **已修复**：v1.9.5 修复了"普通模式点下载静默失败"的 bug（根因：`selectedList` 为空，下载分支什么都不做）

### 2.3 修改版公告
- `src/navigation/components/ModNoticeModal.tsx`：10 秒倒计时同意
- 协议弹窗后接续弹出；老用户首启也弹

### 2.4 网易云登录（实验性）
- **主通道**：内置浏览器登录 `src/navigation/components/WyLoginModal.tsx`
  - WebView 打开 `https://music.163.com/m/login`
  - 原生模块 `android/.../cookie/CookieModule.java` 读 HttpOnly MUSIC_U（已在 MainApplication 注册）
  - JS 封装 `src/utils/nativeModules/cookie.ts`
  - 1.5s 轮询 Cookie → 验证有效性后保存 `wy.musicUToken` + `wy.userInfo`
- **备选通道**：扫码登录 `src/navigation/components/WyQrLoginModal.tsx`
  - 内置 QR 渲染 `src/utils/qrcode.js`（vendored qrcode-generator@1.4.4，MIT）
  - API：`src/utils/musicSdk/wy/login.js`（getQrKey / getQrUrl / checkQrStatus）
  - **实测二维码约 20 秒过期**，已标记不稳定
- **登录态接口修正**：原 `/weapi/login/status` 返回 404，改用 `/weapi/w/nuser/account/get`
- **依赖**：新增 `react-native-webview@^13.17.0`

### 2.5 网易云歌单快照（★ v1.9.7 核心功能）
- **核心**：`src/core/wySnapshot.ts`（约 270 行）
  - 登录成功后自动**全量保存**歌单+歌曲到本地（AsyncStorage）
  - 存储键：`@wy_snapshot_meta`（元信息）+ `@wy_snapshot_songs__<id>`（每个歌单的歌曲）
  - 串行保存，单歌单 800ms 间隔（防限流）；失败保留旧数据不中断
  - 自动更新：设置项 `wy.snapshotUpdateInterval`（12/24/48h/off），进入歌单页或启动时检查
  - 导出导入：`.lxmc` 文件（gzip JSON），合并逻辑（新增自动加、相同跳过、有缺失询问是否移除）
  - 日志前缀 `[WY 快照]`
- **UI**：`src/screens/Home/Views/WySonglist/index.tsx`（快照优先展示 + 工具栏 + ChoosePath 导出导入）
- **设置**：`WySnapshotInterval.tsx`（CheckBox 选择间隔）
- **启动**：`src/core/init/index.ts` 在 initDownload 后异步调用 `checkAndAutoUpdate()`

### 2.6 侧边栏「网易云歌单」菜单项
- `src/config/constant.ts`：`NAV_MENUS` 新增 `nav_wy_songlist`（icon: null，无图标纯文字）
- `Vertical/DrawerNav.tsx` + `Horizontal/Aside.tsx`：MenuItem icon 类型改为 `string | null`，适配空图标
- `Vertical/Main.tsx`：新增 `WySonglistPage`（lazy render）
- `Horizontal/Main.tsx`：新增 `nav_wy_songlist` case

---

## 3. 规范与坑（必须遵守）

### 3.1 tsc
- **只说 "5 errors" 不能说"干净"**——下游审核脚本只看数字
- 4 个文件 5 个错误是上游遗留，**不要修**：
  1. `src/core/player/timeoutExit.ts`
  2. `src/plugins/player/hook.ts`
  3. `src/screens/Home/Views/SongList/HeaderBar/SourceSelector.tsx`
  4. `src/store/player/action.ts`（2 个错误）
- 任何改动后**立即跑 tsc**：`node_modules/.bin/tsc --noEmit`，仅这 4 个文件报错即视为通过

### 3.2 eslint
- **必须过**，提交前对改动文件跑 `node_modules/.bin/eslint <文件...>`
- 高频错误：`eol-last`（文件末尾需空行）、`curly`（单行 if 也需大括号）、`promise-function-async`（返回 Promise 的函数必须声明 async）、`import/no-duplicates`（禁止重复 import 同一模块）、`require-atomic-updates`（跨 await 的变量赋值得用对象包装）

### 3.3 i18n 三语同步
- 新增文案**必须同时加** `src/lang/zh-cn.json` / `zh-tw.json` / `en-us.json`
- 三个文件 key 数量必须完全一致（当前 612 个），否则 tsc 报错
- 插入新 key 靠尾部追加（JSON 最后一行 `}` 之前，最后一个 key 后加逗号）

### 3.4 RNN overlay 弹窗
- 四个文件必须同时改：`screenNames.ts`（常量名 `WY_X_MODAL`）→ `utils.ts`（`showXModal()` 函数 + import）→ `registerScreens.tsx`（import + `registerComponent` + `WrappedComponent` 包装）→ 组件文件本身
- 函数模板照抄 `showDownloadModal`：300ms 防抖 + `Navigation.showOverlay` + `interceptTouchOutside: true`
- **组件参数只能有 `componentId: string`**，不能多传自定义 props（RNN overlay 不支持 passProps）

### 3.5 其他代码禁忌
- react-native-webview：**不能用 `useRef<WebView>` + `ref.reload()`**（类型有两套兼容不了），用条件渲染重挂载代替
- 不要用 `@react-native-community/clipboard` 以外的剪贴板库
- 不要引入新原生依赖（WebView 已是例外）
- 沙箱里**不要用 pip/pip3 install** 安装 Python 包（用环境里现有的）
- 音源串行、下载串行——**不要加并发**

---

## 4. 验证命令

```bash
# 语法检查（提交前必做）
cd /workspace/lx-music-mobile
node_modules/.bin/tsc --noEmit 2>&1 | grep -c "error TS"   # 必须=5
node_modules/.bin/eslint <你改的文件>                         # 必须空输出

# JSON 合法性
python3 -c "import json; json.load(open('src/lang/zh-cn.json')); print('OK')"

# 提交
git add -A && git commit -m "feat/fix/docs: <描述>" && \
git push "https://<TOKEN_PLACEHOLDER>@github.com/azx8788a/lx-music-mobile.git" master
```

---

## 5. 构建与发布

- push master **会自动触发构建**（on.push 分支 master），不需要手动
- 产物 10-20 分钟后出现在 Release 页 `v<package.json版本号>`（5 个 APK：arm64-v8a / armeabi-v7a / x86_64 / x86 / universal）
- 手动触发（仅在有构建异常时用）：
```bash
curl -X POST -H "Authorization: token <TOKEN_PLACEHOLDER>" \
  https://api.github.com/repos/azx8788a/lx-music-mobile/actions/workflows/release.yml/dispatches \
  -d '{"ref":"master"}'
```
- 查询最新构建：`curl -s -H "Authorization: token ghp_Gn..." "https://api.github.com/repos/azx8788a/lx-music-mobile/actions/runs?per_page=3"`

---

## 6. 已上传的周边文件

| 文件 | 位置 |
|---|---|
| 交接文档（人类阅读） | 仓库根 `交接文档.md` |
| 下载功能排查报告 | 仓库根 `下载功能排查报告.md` |
| 专家解答全文 | `/upload/`（c09df68b-...txt 和 021d6523-...txt） |
| 音源原始包 | `/workspace/V260917.zip` |
| 签名密钥 | `/workspace/_keystore/` |

---

## 7. 当前未完成任务（按优先级）

### 7.1 P0：下载的文件缺少歌词/标签（刚提出的）
- 现状：`runNext()` 下载完成时只保存了裸音频文件（mp3/flac），没有嵌入元数据和歌词
- 要做的：下载完成后获取在线歌词 → 保存为同名 `.lrc` 文件（或嵌入 ID3 标签）
- 关键文件：`src/core/download/index.ts`（runNext 的 finally → completed 段）
- 歌词获取：`src/core/lyric.ts` 的 `getLyric()` / `getLyricInfo()`；各音源有 `getLyric()` 方法
- 元数据编辑：`react-native-local-media-metadata` 已安装（项目依赖中），可从 metadata 读取/写入标签

### 7.2 P1：存储 CI 实验还没出最终结果
- `.github/workflows/storage-check.yml`：第三次运行中（前两次因 KVM/APK 安装问题失败）
- 目的：在 API 30/33 模拟器上验证 target 29 + legacy 通道可用性
- 若成功 → 验证 legacy 通道全线可用，存储问题关闭
- 若失败 → 需考虑 MANAGE_EXTERNAL_STORAGE 直达页（专家方案已预留但代码未写）

### 7.3 P2：真机验证待做
- Android 10 + Android 13 各一台真机，装 v1.9.7 测下载
- 重点测国产 ROM（MIUI/ColorOS/鸿蒙）二级权限墙
- 用户型号反馈：疑似华为/荣耀（鸿蒙或 EMUI 13+），"权限管理"页名称为"音乐和音频"

---

## 8. 关键文件索引（快速定位）

| 功能 | 文件 |
|---|---|
| 下载核心 | `src/core/download/index.ts` |
| 下载选择/管理弹窗 | `src/navigation/components/DownloadModal.tsx` / `DownloadManagerModal.tsx` |
| 歌曲菜单下载入口 | `src/components/OnlineList/ListMenu.tsx`、`src/screens/Home/Views/Mylist/MusicList/ListMenu.tsx` |
| 存储权限 | `src/utils/storagePermission.ts` |
| 文件系统 | `src/utils/fs.ts` |
| 日志 | `src/utils/log.ts` |
| 网易云登录 | `src/navigation/components/WyLoginModal.tsx` / `WyQrLoginModal.tsx` |
| 网易云 API | `src/utils/musicSdk/wy/login.js` / `userPlaylist.js` |
| 原生 Cookie 模块 | `android/.../cookie/CookieModule.java` + `src/utils/nativeModules/cookie.ts` |
| QR 渲染 | `src/utils/qrcode.js` |
| 歌单快照 | `src/core/wySnapshot.ts` |
| 网易云歌单页 | `src/screens/Home/Views/WySonglist/index.tsx` |
| 存储诊断 | `src/utils/storagePermission.ts` 的 `collectStorageDiagnostics()` |
| 主应用/导航 | `src/app.ts` / `src/navigation/`（utils / screenNames / registerScreens） |
| 配置常量 | `src/config/constant.ts` |
| 设置默认值 | `src/config/defaultSetting.ts` |
| 类型定义 | `src/types/`（app_setting / download_list / music 等） |
| 多语言 | `src/lang/`（zh-cn / zh-tw / en-us） |
| 原生入口 | `android/app/src/main/java/cn/toside/music/mobile/MainApplication.java` |
| AndroidManifest | `android/app/src/main/AndroidManifest.xml` |
| CI 工作流 | `.github/workflows/release.yml` / `storage-check.yml` |

---

**给下一个模型的补充指南**（以上正式文档结束）

附录：开发沙箱环境说明
- 系统：Ubuntu 24.04 aarch64 proot，Node v20
- node_modules 已装在 `/workspace/lx-music-mobile/node_modules`（360MB）
- `npm ci` 可跑但较慢（约 3-5 分钟）；如果只做代码编辑不改依赖，不需要重跑
- Python 3.12 已预装（无 pip 额外包，不要再用 pip install）
- `aapt` / `aapt2` 已预装（可用于 APK 分析）
- 后台进程可能被杀（proot 限制），长任务在前台跑
- 用户偏好：文件权限 666、目录 777；不装无关工具；大改动前先对齐方案；耗时敏感

附录：当前对话的关键记忆 ID
- Memory 18：项目整体信息（最新状态）
- Memory 10：Azx8788 GitHub 账号 Token
- Memory 19：azx8788a GitHub 账号 Token
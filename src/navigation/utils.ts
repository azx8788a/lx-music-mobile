import { Navigation } from 'react-native-navigation'
import {
  VERSION_MODAL,
  PACT_MODAL,
  SYNC_MODE_MODAL,
  DOWNLOAD_MODAL,
  DOWNLOAD_MANAGER_MODAL,
  MOD_NOTICE_MODAL,
  WY_USER_PLAYLIST_MODAL,
  WY_LOGIN_MODAL,
} from './screenNames'
import themeState from '@/store/theme/state'

const lastOverlayShowTime: Record<string, number> = {}


export const getStatusBarStyle = (isDark: boolean) => isDark ? 'light' : 'dark'

export const dismissOverlay = async(compId: string) => Navigation.dismissOverlay(compId)

export const pop = async(compId: string) => Navigation.pop(compId)
export const popToRoot = async(compId: string) => Navigation.popToRoot(compId)
export const popTo = async(compId: string) => Navigation.popTo(compId)

export const showWyLoginModal = () => {
  const theme = themeState.theme
  const now = Date.now()
  if (lastOverlayShowTime[WY_LOGIN_MODAL] && now - lastOverlayShowTime[WY_LOGIN_MODAL] < 300) return
  lastOverlayShowTime[WY_LOGIN_MODAL] = now

  void Navigation.showOverlay({
    component: {
      name: WY_LOGIN_MODAL,
      options: {
        layout: {
          componentBackgroundColor: 'transparent',
        },
        overlay: {
          interceptTouchOutside: true,
        },
        statusBar: {
          drawBehind: true,
          visible: true,
          style: getStatusBarStyle(theme.isDark),
          backgroundColor: 'transparent',
        },
        navigationBar: {
          backgroundColor: theme['c-content-background'],
        },
      },
    },
  })
}

export const showWyUserPlaylistModal = () => {
  const theme = themeState.theme
  const now = Date.now()
  if (lastOverlayShowTime[WY_USER_PLAYLIST_MODAL] && now - lastOverlayShowTime[WY_USER_PLAYLIST_MODAL] < 300) return
  lastOverlayShowTime[WY_USER_PLAYLIST_MODAL] = now

  void Navigation.showOverlay({
    component: {
      name: WY_USER_PLAYLIST_MODAL,
      options: {
        layout: {
          componentBackgroundColor: 'transparent',
        },
        overlay: {
          interceptTouchOutside: true,
        },
        statusBar: {
          drawBehind: true,
          visible: true,
          style: getStatusBarStyle(theme.isDark),
          backgroundColor: 'transparent',
        },
        navigationBar: {
          backgroundColor: theme['c-content-background'],
        },
      },
    },
  })
}

export const showModNoticeModal = () => {
  const theme = themeState.theme
  const now = Date.now()
  if (lastOverlayShowTime[MOD_NOTICE_MODAL] && now - lastOverlayShowTime[MOD_NOTICE_MODAL] < 300) return
  lastOverlayShowTime[MOD_NOTICE_MODAL] = now

  void Navigation.showOverlay({
    component: {
      name: MOD_NOTICE_MODAL,
      options: {
        layout: {
          componentBackgroundColor: 'transparent',
        },
        overlay: {
          interceptTouchOutside: true,
        },
        statusBar: {
          drawBehind: true,
          visible: true,
          style: getStatusBarStyle(theme.isDark),
          backgroundColor: 'transparent',
        },
        navigationBar: {
          backgroundColor: theme['c-content-background'],
        },
      },
    },
  })
}

export const showDownloadModal = () => {
  const theme = themeState.theme
  const now = Date.now()
  if (lastOverlayShowTime[DOWNLOAD_MODAL] && now - lastOverlayShowTime[DOWNLOAD_MODAL] < 300) return
  lastOverlayShowTime[DOWNLOAD_MODAL] = now

  void Navigation.showOverlay({
    component: {
      name: DOWNLOAD_MODAL,
      options: {
        layout: {
          componentBackgroundColor: 'transparent',
        },
        overlay: {
          interceptTouchOutside: true,
        },
        statusBar: {
          drawBehind: true,
          visible: true,
          style: getStatusBarStyle(theme.isDark),
          backgroundColor: 'transparent',
        },
        navigationBar: {
          backgroundColor: theme['c-content-background'],
        },
      },
    },
  })
}

export const showDownloadManagerModal = () => {
  const theme = themeState.theme
  const now = Date.now()
  if (lastOverlayShowTime[DOWNLOAD_MANAGER_MODAL] && now - lastOverlayShowTime[DOWNLOAD_MANAGER_MODAL] < 300) return
  lastOverlayShowTime[DOWNLOAD_MANAGER_MODAL] = now

  void Navigation.showOverlay({
    component: {
      name: DOWNLOAD_MANAGER_MODAL,
      options: {
        layout: {
          componentBackgroundColor: 'transparent',
        },
        overlay: {
          interceptTouchOutside: true,
        },
        statusBar: {
          drawBehind: true,
          visible: true,
          style: getStatusBarStyle(theme.isDark),
          backgroundColor: 'transparent',
        },
        navigationBar: {
          backgroundColor: theme['c-content-background'],
        },
      },
    },
  })
}

export const showPactModal = () => {
  const theme = themeState.theme

  void Navigation.showOverlay({
    component: {
      name: PACT_MODAL,
      options: {
        layout: {
          componentBackgroundColor: 'transparent',
        },
        overlay: {
          interceptTouchOutside: true,
        },
        statusBar: {
          drawBehind: true,
          visible: true,
          style: getStatusBarStyle(theme.isDark),
          backgroundColor: 'transparent',
        },
        navigationBar: {
          // visible: false,
          backgroundColor: theme['c-content-background'],
        },
        // animations: {

        //   showModal: {
        //     enter: {
        //       enabled: true,
        //       alpha: {
        //         from: 0,
        //         to: 1,
        //         duration: 300,
        //       },
        //     },
        //     exit: {
        //       enabled: true,
        //       alpha: {
        //         from: 1,
        //         to: 0,
        //         duration: 300,
        //       },
        //     },
        //   },
        // },
      },
    },
  })
}

export const showVersionModal = () => {
  const theme = themeState.theme

  void Navigation.showOverlay({
    component: {
      name: VERSION_MODAL,
      options: {
        layout: {
          componentBackgroundColor: 'transparent',
        },
        overlay: {
          interceptTouchOutside: true,
        },
        statusBar: {
          drawBehind: true,
          visible: true,
          style: getStatusBarStyle(theme.isDark),
          backgroundColor: 'transparent',
        },
        navigationBar: {
          // visible: false,
          backgroundColor: theme['c-content-background'],
        },
        // animations: {

        //   showModal: {
        //     enter: {
        //       enabled: true,
        //       alpha: {
        //         from: 0,
        //         to: 1,
        //         duration: 300,
        //       },
        //     },
        //     exit: {
        //       enabled: true,
        //       alpha: {
        //         from: 1,
        //         to: 0,
        //         duration: 300,
        //       },
        //     },
        //   },
        // },
      },
    },
  })
}

export const showSyncModeModal = () => {
  const theme = themeState.theme

  void Navigation.showOverlay({
    component: {
      name: SYNC_MODE_MODAL,
      options: {
        layout: {
          componentBackgroundColor: 'transparent',
        },
        overlay: {
          interceptTouchOutside: true,
        },
        statusBar: {
          drawBehind: true,
          visible: true,
          style: getStatusBarStyle(theme.isDark),
          backgroundColor: 'transparent',
        },
        navigationBar: {
          // visible: false,
          backgroundColor: theme['c-content-background'],
        },
        // animations: {

        //   showModal: {
        //     enter: {
        //       enabled: true,
        //       alpha: {
        //         from: 0,
        //         to: 1,
        //         duration: 300,
        //       },
        //     },
        //     exit: {
        //       enabled: true,
        //       alpha: {
        //         from: 1,
        //         to: 0,
        //         duration: 300,
        //       },
        //     },
        //   },
        // },
      },
    },
  })
}

// export const showToast = (text) => {
//   Navigation.showOverlay({
//     component: {
//       name: TOAST_SCREEN,
//     },
//   })
// }

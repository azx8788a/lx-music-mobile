// @flow

import { Navigation } from 'react-native-navigation'

import {
  Home,
  PlayDetail,
  SonglistDetail,
  Comment,
  // Setting,
} from '@/screens'
import { Provider } from '@/store/Provider'

import {
  HOME_SCREEN,
  PLAY_DETAIL_SCREEN,
  SONGLIST_DETAIL_SCREEN,
  COMMENT_SCREEN,
  VERSION_MODAL,
  PACT_MODAL,
  SYNC_MODE_MODAL,
  DOWNLOAD_MODAL,
  DOWNLOAD_MANAGER_MODAL,
  MOD_NOTICE_MODAL,
  WY_USER_PLAYLIST_MODAL,
  WY_LOGIN_MODAL,
  WY_QR_LOGIN_MODAL,
  // SETTING_SCREEN,
} from './screenNames'
import VersionModal from './components/VersionModal'
import PactModal from './components/PactModal'
import SyncModeModal from './components/SyncModeModal'
import DownloadModal from './components/DownloadModal'
import DownloadManagerModal from './components/DownloadManagerModal'
import ModNoticeModal from './components/ModNoticeModal'
import WyUserPlaylistModal from './components/WyUserPlaylistModal'
import WyLoginModal from './components/WyLoginModal'
import WyQrLoginModal from './components/WyQrLoginModal'

function WrappedComponent(Component: any) {
  return function inject(props: Record<string, any>) {
    const EnhancedComponent = () => (
      <Provider>
        <Component
          {...props}
        />
      </Provider>
    )

    return <EnhancedComponent />
  }
}

export default () => {
  Navigation.registerComponent(HOME_SCREEN, () => WrappedComponent(Home))
  Navigation.registerComponent(PLAY_DETAIL_SCREEN, () => WrappedComponent(PlayDetail))
  Navigation.registerComponent(SONGLIST_DETAIL_SCREEN, () => WrappedComponent(SonglistDetail))
  Navigation.registerComponent(COMMENT_SCREEN, () => WrappedComponent(Comment))
  Navigation.registerComponent(VERSION_MODAL, () => WrappedComponent(VersionModal))
  Navigation.registerComponent(PACT_MODAL, () => WrappedComponent(PactModal))
  Navigation.registerComponent(SYNC_MODE_MODAL, () => WrappedComponent(SyncModeModal))
  Navigation.registerComponent(DOWNLOAD_MODAL, () => WrappedComponent(DownloadModal))
  Navigation.registerComponent(DOWNLOAD_MANAGER_MODAL, () => WrappedComponent(DownloadManagerModal))
  Navigation.registerComponent(MOD_NOTICE_MODAL, () => WrappedComponent(ModNoticeModal))
  Navigation.registerComponent(WY_USER_PLAYLIST_MODAL, () => WrappedComponent(WyUserPlaylistModal))
  Navigation.registerComponent(WY_LOGIN_MODAL, () => WrappedComponent(WyLoginModal))
  Navigation.registerComponent(WY_QR_LOGIN_MODAL, () => WrappedComponent(WyQrLoginModal))
  // Navigation.registerComponent(SETTING_SCREEN, () => WrappedComponent(Setting))

  console.info('All screens have been registered...')
}

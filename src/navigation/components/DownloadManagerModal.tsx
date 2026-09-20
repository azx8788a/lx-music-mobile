import { View, ScrollView, TouchableOpacity } from 'react-native'
import { Navigation } from 'react-native-navigation'

import Button from '@/components/common/Button'
import ModalContent from './ModalContent'
import Text from '@/components/common/Text'
import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang/index'
import { useTaskList } from '@/store/download'
import { pauseTask, resumeTask, retryTask, removeTask } from '@/core/download'


const TaskRow = ({ task }: { task: LX.Download.ListItem }) => {
  const theme = useTheme()
  const t = useI18n()

  let statusText: string
  switch (task.status) {
    case 'waiting': statusText = t('download_status_waiting'); break
    case 'run': statusText = `${t('download_status_downloading')} ${Math.floor(task.progress * 100)}%`; break
    case 'pause': statusText = t('download_status_pause'); break
    case 'completed': statusText = t('download_status_completed'); break
    case 'error': statusText = `${t('download_status_error')}${task.errorCode ? ` [${task.errorCode}]` : ''}${task.statusText ? `: ${task.statusText}` : ''}`; break
  }

  return (
    <View style={styles.task}>
      <Text size={13} numberOfLines={1}>{task.metadata.musicInfo.name} - {task.metadata.musicInfo.singer}</Text>
      <Text style={{ opacity: 0.7 }} size={11} numberOfLines={1}>
        {task.metadata.quality} · {statusText}{task.status == 'run' && task.speed ? ` · ${task.speed}` : ''}
      </Text>
      <View style={styles.progressBg}>
        <View style={{ ...styles.progressBar, width: `${Math.floor(task.progress * 100)}%`, backgroundColor: theme['c-primary'] }}></View>
      </View>
      <View style={styles.taskBtns}>
        {
          task.status == 'run'
            ? <TouchableOpacity onPress={() => { pauseTask(task.id) }}><Text size={12} color={theme['c-primary-font']}>{t('download_pause')}</Text></TouchableOpacity>
            : null
        }
        {
          task.status == 'pause'
            ? <TouchableOpacity onPress={() => { resumeTask(task.id) }}><Text size={12} color={theme['c-primary-font']}>{t('download_resume')}</Text></TouchableOpacity>
            : null
        }
        {
          task.status == 'error'
            ? <TouchableOpacity onPress={() => { retryTask(task.id) }}><Text size={12} color={theme['c-primary-font']}>{t('download_retry')}</Text></TouchableOpacity>
            : null
        }
        <TouchableOpacity onPress={() => { removeTask(task.id).catch(() => {}) }}><Text size={12} style={{ opacity: 0.7 }}>{t('download_remove')}</Text></TouchableOpacity>
      </View>
    </View>
  )
}

const DownloadManagerModal = ({ componentId }: { componentId: string }) => {
  const theme = useTheme()
  const t = useI18n()
  const taskList = useTaskList()

  const handleClose = () => {
    void Navigation.dismissOverlay(componentId)
  }

  return (
    <ModalContent>
      <View style={styles.main}>
        <Text style={styles.title} size={18}>{t('download_manager')}</Text>
        <ScrollView style={styles.content} keyboardShouldPersistTaps={'always'}>
          {
            taskList.length
              ? taskList.map(task => <TaskRow key={task.id} task={task} />)
              : <Text style={styles.empty} size={13}>{t('download_empty')}</Text>
          }
        </ScrollView>
        <View style={styles.totalTip}>
          <Text size={12} style={{ opacity: 0.6 }}>{t('download_total')} {taskList.length}</Text>
        </View>
      </View>
      <View style={styles.btns}>
        <Button style={{ ...styles.btn, backgroundColor: theme['c-button-background'] }} onPress={handleClose}>
          <Text color={theme['c-button-font']}>{t('close')}</Text>
        </Button>
      </View>
    </ModalContent>
  )
}

const styles = createStyle({
  main: {
    flexShrink: 1,
    marginTop: 15,
    marginBottom: 10,
  },
  title: {
    textAlign: 'center',
    marginBottom: 10,
  },
  content: {
    flexGrow: 0,
    flexShrink: 1,
    paddingLeft: 15,
    paddingRight: 15,
    maxHeight: 320,
  },
  empty: {
    textAlign: 'center',
    paddingTop: 20,
    paddingBottom: 20,
    opacity: 0.6,
  },
  task: {
    marginBottom: 12,
  },
  progressBg: {
    height: 4,
    borderRadius: 2,
    marginTop: 5,
    marginBottom: 5,
    backgroundColor: 'rgba(128,128,128,0.3)',
    overflow: 'hidden',
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
  },
  taskBtns: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 15,
  },
  totalTip: {
    paddingLeft: 15,
    paddingRight: 15,
    paddingTop: 5,
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
  },
})

export default DownloadManagerModal

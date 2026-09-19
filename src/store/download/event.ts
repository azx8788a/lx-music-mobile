import Event from '@/event/Event'


class DownloadEvent extends Event {
  list_changed(list: LX.Download.ListItem[]) {
    this.emit('list_changed', list)
  }

  task_changed(task: LX.Download.ListItem) {
    this.emit('task_changed', task)
  }
}


type EventMethods = Omit<EventType, keyof Event>


declare class EventType extends DownloadEvent {
  on<K extends keyof EventMethods>(event: K, listener: EventMethods[K]): any
  off<K extends keyof EventMethods>(event: K, listener: EventMethods[K]): any
}

type DownloadEventTypes = Omit<EventType, keyof Omit<Event, 'on' | 'off'>>


export const event: DownloadEventTypes = new DownloadEvent()

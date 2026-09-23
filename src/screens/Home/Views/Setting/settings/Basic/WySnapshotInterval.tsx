import { memo, useMemo } from 'react'

import { StyleSheet, View } from 'react-native'

import SubTitle from '../../components/SubTitle'
import CheckBox from '@/components/common/CheckBox'
import Text from '@/components/common/Text'
import { useSettingValue } from '@/store/setting/hook'
import { useI18n } from '@/lang'
import { updateSetting } from '@/core/common'


type IntervalId = '12' | '24' | '48' | 'off'

const setIntervalValue = (value: IntervalId) => {
  updateSetting({ 'wy.snapshotUpdateInterval': value })
}

const Item = ({ id }: { id: IntervalId }) => {
  const t = useI18n()
  const value = useSettingValue('wy.snapshotUpdateInterval')
  const isActive = useMemo(() => value == id, [value, id])
  return <CheckBox marginBottom={3} check={isActive} label={t(`setting_basic_wy_snapshot_interval_${id}`)} onChange={() => { setIntervalValue(id) }} need />
}

export default memo(() => {
  const t = useI18n()
  const list = useMemo(() => {
    return [{ id: '12' }, { id: '24' }, { id: '48' }, { id: 'off' }] as const
  }, [])

  return (
    <SubTitle title={t('setting_basic_wy_snapshot_interval')}>
      <View style={styles.list}>
        {
          list.map(({ id }) => <Item id={id} key={id} />)
        }
      </View>
      <Text size={11} style={styles.hint}>{t('setting_basic_wy_snapshot_interval_tip')}</Text>
    </SubTitle>
  )
})

const styles = StyleSheet.create({
  list: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  hint: {
    opacity: 0.6,
    lineHeight: 16,
    marginTop: 5,
  },
})

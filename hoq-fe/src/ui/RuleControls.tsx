import React from 'react';
import { View } from 'react-native';
import type { Config } from '../game/types';
import { TURN_OPTIONS } from '../game/setup';
import { Button, Label } from './components';

export function RuleControls({ config, onChange, disabled = false }: { config: Config; onChange(config: Config): void; disabled?: boolean }) {
  return <View style={{ gap: 12 }}>
    <Label>TARGET SCORE</Label><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{[15, 30, 50].map(target =>
      <Button key={target} small disabled={disabled} label={`${target} PTS`} tone={target === config.target ? 'lime' : 'cream'} onPress={() => onChange({ ...config, target })} />)}</View>
    <Label>TIME PER TURN</Label><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{TURN_OPTIONS.map(seconds => {
      const turnMs = seconds === null ? null : seconds * 1000;
      return <Button key={seconds ?? 'unlimited'} small disabled={disabled} label={seconds === null ? 'UNLIMITED' : `${seconds} SEC`} tone={turnMs === config.turnMs ? 'lime' : 'cream'} onPress={() => onChange({ ...config, turnMs })} />;
    })}</View>
  </View>;
}

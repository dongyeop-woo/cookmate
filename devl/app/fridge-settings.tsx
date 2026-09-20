import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  loadFridgeSettings,
  saveFridgeSettings,
  DEFAULT_SETTINGS,
  COLOR_PRESETS,
  type FridgeSettings,
  type ExpiryColors,
} from '../services/fridgeSettings';
import { getFridge } from '../services/fridge';
import { rebuildExpiryNotifications } from '../services/fridgeNotifications';

const TEXT = '#1A1A1A';
const SUBTEXT = '#8E8E93';
const BORDER = '#ECECEC';
const SURFACE = '#F5F5F7';

export default function FridgeSettingsScreen() {
  const router = useRouter();
  const [settings, setSettings] = useState<FridgeSettings>(DEFAULT_SETTINGS);
  const [urgentInput, setUrgentInput] = useState('1');
  const [soonInput, setSoonInput] = useState('3');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadFridgeSettings().then(s => {
      setSettings(s);
      setUrgentInput(String(s.urgentDays));
      setSoonInput(String(s.soonDays));
    });
  }, []);

  const pickPreset = (colors: ExpiryColors) => {
    setSettings(prev => ({ ...prev, colors }));
  };

  const handleSave = async () => {
    const urgent = parseInt(urgentInput, 10);
    const soon = parseInt(soonInput, 10);
    if (isNaN(urgent) || urgent < 0 || urgent > 30) {
      Alert.alert('알림', '임박 기준은 0~30일 사이로 입력해주세요');
      return;
    }
    if (isNaN(soon) || soon <= urgent || soon > 60) {
      Alert.alert('알림', `곧 만료 기준은 ${urgent + 1}~60일 사이로 입력해주세요`);
      return;
    }
    setSaving(true);
    try {
      const next: FridgeSettings = {
        ...settings,
        urgentDays: urgent,
        soonDays: soon,
      };
      await saveFridgeSettings(next);
      try {
        const fridgeList = await getFridge();
        await rebuildExpiryNotifications(fridgeList, next);
      } catch {}
      router.back();
    } catch (e: any) {
      Alert.alert('저장 실패', e?.message || '다시 시도해주세요');
    } finally {
      setSaving(false);
    }
  };

  const resetToDefault = () => {
    Alert.alert('기본값으로 되돌리기', '설정이 초기화됩니다', [
      { text: '취소', style: 'cancel' },
      {
        text: '초기화',
        style: 'destructive',
        onPress: () => {
          setSettings(DEFAULT_SETTINGS);
          setUrgentInput(String(DEFAULT_SETTINGS.urgentDays));
          setSoonInput(String(DEFAULT_SETTINGS.soonDays));
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}>
          <Ionicons name="chevron-back" size={26} color={TEXT} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} pointerEvents="none">냉장고 설정</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving} hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}>
          <Text style={[styles.saveText, saving && { opacity: 0.4 }]}>저장</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* 미리보기 */}
        <View style={styles.previewBox}>
          <Text style={styles.previewLabel}>미리보기</Text>
          <View style={styles.previewRow}>
            <PreviewChip label="오늘까지" color={settings.colors.urgent} />
            <PreviewChip label={`${settings.urgentDays}일 남음`} color={settings.colors.urgent} />
            <PreviewChip label={`${settings.soonDays}일 남음`} color={settings.colors.soon} />
            <PreviewChip label="10일 남음" color={settings.colors.ok} />
          </View>
        </View>

        {/* 기준 일수 */}
        <Text style={styles.sectionTitle}>유효기간 기준</Text>
        <Text style={styles.sectionDesc}>재료가 얼마나 남았을 때 강조할지 정해주세요</Text>

        <View style={styles.rowCard}>
          <View style={[styles.colorDot, { backgroundColor: settings.colors.urgent }]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.rowLabel}>임박 (강한 강조)</Text>
            <Text style={styles.rowDesc}>이 일수 이하로 남으면 가장 눈에 띄게</Text>
          </View>
          <View style={styles.numInputWrap}>
            <TextInput
              value={urgentInput}
              onChangeText={(v) => setUrgentInput(v.replace(/[^0-9]/g, '').slice(0, 2))}
              keyboardType="number-pad"
              style={styles.numInput}
              maxLength={2}
            />
            <Text style={styles.numUnit}>일 이하</Text>
          </View>
        </View>

        <View style={styles.rowCard}>
          <View style={[styles.colorDot, { backgroundColor: settings.colors.soon }]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.rowLabel}>곧 만료 (중간 강조)</Text>
            <Text style={styles.rowDesc}>임박까진 아니지만 챙겨둬야 할 수준</Text>
          </View>
          <View style={styles.numInputWrap}>
            <TextInput
              value={soonInput}
              onChangeText={(v) => setSoonInput(v.replace(/[^0-9]/g, '').slice(0, 2))}
              keyboardType="number-pad"
              style={styles.numInput}
              maxLength={2}
            />
            <Text style={styles.numUnit}>일 이하</Text>
          </View>
        </View>

        {/* 색상 프리셋 */}
        <Text style={styles.sectionTitle}>색상 테마</Text>
        <Text style={styles.sectionDesc}>임박·만료 상태를 표시할 색상을 골라주세요</Text>

        <View style={styles.presetList}>
          {COLOR_PRESETS.map(preset => {
            const isActive = settings.colors.urgent === preset.colors.urgent
              && settings.colors.soon === preset.colors.soon
              && settings.colors.ok === preset.colors.ok;
            return (
              <TouchableOpacity
                key={preset.key}
                style={[styles.presetRow, isActive && styles.presetRowActive]}
                onPress={() => pickPreset(preset.colors)}
                activeOpacity={0.8}
              >
                <View style={styles.presetDots}>
                  <View style={[styles.presetDot, { backgroundColor: preset.colors.urgent }]} />
                  <View style={[styles.presetDot, { backgroundColor: preset.colors.soon }]} />
                  <View style={[styles.presetDot, { backgroundColor: preset.colors.ok }]} />
                </View>
                <Text style={[styles.presetLabel, isActive && styles.presetLabelActive]}>
                  {preset.label}
                </Text>
                {isActive && (
                  <Ionicons name="checkmark-circle" size={20} color={TEXT} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity style={styles.resetBtn} onPress={resetToDefault}>
          <Ionicons name="refresh" size={14} color={SUBTEXT} />
          <Text style={styles.resetBtnText}>기본값으로 되돌리기</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function PreviewChip({ label, color }: { label: string; color: string }) {
  return (
    <View style={styles.previewChip}>
      <View style={[styles.previewChipDot, { backgroundColor: color }]} />
      <Text style={[styles.previewChipText, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    position: 'relative',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: TEXT,
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    zIndex: -1,
  },
  saveText: {
    fontSize: 15,
    fontWeight: '700',
    color: TEXT,
  },

  // 미리보기
  previewBox: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    backgroundColor: SURFACE,
    borderRadius: 14,
  },
  previewLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: SUBTEXT,
    marginBottom: 10,
  },
  previewRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  previewChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  previewChipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  previewChipText: {
    fontSize: 12,
    fontWeight: '700',
  },

  // 섹션
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: TEXT,
    marginTop: 28,
    marginBottom: 4,
    paddingHorizontal: 16,
  },
  sectionDesc: {
    fontSize: 12,
    color: SUBTEXT,
    marginBottom: 12,
    paddingHorizontal: 16,
  },

  // 일수 설정
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 14,
    backgroundColor: SURFACE,
    borderRadius: 14,
  },
  colorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  rowLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: TEXT,
  },
  rowDesc: {
    fontSize: 11,
    color: SUBTEXT,
    marginTop: 2,
  },
  numInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  numInput: {
    width: 42,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '800',
    color: TEXT,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
  },
  numUnit: {
    fontSize: 12,
    fontWeight: '600',
    color: SUBTEXT,
  },

  // 프리셋
  presetList: {
    marginHorizontal: 16,
    gap: 8,
  },
  presetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: 14,
    backgroundColor: SURFACE,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  presetRowActive: {
    backgroundColor: '#FFFFFF',
    borderColor: TEXT,
  },
  presetDots: {
    flexDirection: 'row',
    gap: 4,
  },
  presetDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  presetLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: SUBTEXT,
  },
  presetLabelActive: {
    color: TEXT,
  },

  // 초기화
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 24,
    paddingVertical: 14,
  },
  resetBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: SUBTEXT,
  },
});

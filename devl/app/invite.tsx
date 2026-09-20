import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

/**
 * 초대 보상 시스템이 제거되어 이 화면은 더 이상 사용되지 않는다.
 * 라우트는 남겨두되 진입 시 안내만 표시.
 */
export default function InviteScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>친구 초대</Text>
        <View style={{ width: 32 }} />
      </View>

      <View style={styles.body}>
        <Ionicons name="information-circle-outline" size={56} color="#BDBDBD" />
        <Text style={styles.title}>초대 이벤트가 종료되었어요</Text>
        <Text style={styles.desc}>
          더 좋은 보상으로 돌아올 예정이니 조금만 기다려주세요.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EEE',
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A1A' },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  title: { fontSize: 18, fontWeight: '700', color: '#1A1A1A', marginTop: 16 },
  desc: { fontSize: 14, color: '#666', marginTop: 8, textAlign: 'center', lineHeight: 22 },
});

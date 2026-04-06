import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ScrollView,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from './_layout';
import {
  registerForPushNotifications,
  getPushEnabled,
  setPushEnabled as savePushEnabled,
} from '../services/notifications';
import { updatePushToken } from '../services/api';

export default function SettingsScreen() {
  const router = useRouter();
  const { userProfile, setUserProfile, firebaseUser } = useAuth();
  const [pushEnabled, setPushEnabled] = useState(true);

  useEffect(() => {
    getPushEnabled().then(setPushEnabled);
  }, []);

  const handleTogglePush = async (value: boolean) => {
    if (value) {
      const token = await registerForPushNotifications();
      if (!token) {
        Alert.alert(
          '알림 권한 필요',
          '설정에서 알림 권한을 허용해 주세요.',
          [
            { text: '취소', style: 'cancel' },
            { text: '설정으로 이동', onPress: () => Linking.openSettings() },
          ]
        );
        return;
      }
      if (firebaseUser) {
        try {
          await updatePushToken(firebaseUser.uid, token);
        } catch (e) {
          console.warn('푸시 토큰 저장 실패:', e);
        }
      }
    } else {
      if (firebaseUser) {
        try {
          await updatePushToken(firebaseUser.uid, '');
        } catch (e) {
          console.warn('푸시 토큰 삭제 실패:', e);
        }
      }
    }
    setPushEnabled(value);
    await savePushEnabled(value);
  };

  const handleClearCache = () => {
    Alert.alert('캐시 삭제', '캐시가 삭제되었습니다.');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backBtn}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>설정</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>알림</Text>
        <View style={styles.section}>
          <View style={styles.row}>
            <Text style={styles.rowText}>푸시 알림</Text>
            <Switch
              value={pushEnabled}
              onValueChange={handleTogglePush}
              trackColor={{ false: '#E0E0E0', true: '#0B9A61' }}
              thumbColor="#fff"
            />
          </View>
        </View>

        <Text style={styles.sectionTitle}>계정</Text>
        <View style={styles.section}>
          <View style={[styles.row, { borderBottomWidth: 0 }]}>
            <Text style={styles.rowText}>계정 정보</Text>
            <Text style={styles.rowValue}>
              {(() => {
                const provider = firebaseUser?.providerData?.[0]?.providerId;
                if (provider === 'google.com') return '구글 계정';
                return '카카오 계정';
              })()}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>정보</Text>
        <View style={styles.section}>
          <View style={[styles.row, { borderBottomWidth: 0 }]}>
            <Text style={styles.rowText}>앱 버전</Text>
            <Text style={styles.rowValue}>1.0.0</Text>
          </View>
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0F0F0',
  },
  backBtn: { fontSize: 24, color: '#1A1A1A' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A1A' },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#999',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 8,
  },
  section: {
    backgroundColor: '#FFFFFF',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0F0F0',
  },
  rowText: { fontSize: 15, fontWeight: '500', color: '#1A1A1A' },
  rowArrow: { fontSize: 20, color: '#CCC', fontWeight: '300' },
  rowValue: { fontSize: 14, color: '#999' },
});

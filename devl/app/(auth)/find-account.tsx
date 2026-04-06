import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { sendPasswordResetEmail } from 'firebase/auth';
import { authInstance } from '../../firebase';
import { fetchUserByPhone } from '../../services/api';

type FindTab = 'email' | 'password';

export default function FindAccountScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<FindTab>('email');

  // Email recovery
  const [findPhone, setFindPhone] = useState('');
  const [findName, setFindName] = useState('');
  const [foundEmail, setFoundEmail] = useState<string | null>(null);

  // Password recovery
  const [resetEmail, setResetEmail] = useState('');

  const handleFindEmail = async () => {
    if (!findName.trim()) {
      Alert.alert('알림', '이름을 입력해주세요.');
      return;
    }
    if (findPhone.length < 10) {
      Alert.alert('알림', '전화번호를 입력해주세요.');
      return;
    }
    try {
      const user = await fetchUserByPhone(findPhone.replace(/\D/g, ''));
      if (user) {
        const masked = user.email.replace(/(.{3})(.*)(@.*)/, '$1***$3');
        setFoundEmail(masked);
      } else {
        Alert.alert('알림', '해당 정보로 등록된 계정을 찾을 수 없습니다.');
      }
    } catch (e) {
      Alert.alert('오류', '계정 조회에 실패했습니다.');
    }
  };

  const handleResetPassword = async () => {
    if (!resetEmail.trim()) {
      Alert.alert('알림', '이메일을 입력해주세요.');
      return;
    }
    try {
      await sendPasswordResetEmail(authInstance, resetEmail.trim());
      Alert.alert('완료', '비밀번호 재설정 이메일이 발송되었습니다.\n이메일을 확인해주세요.', [
        { text: '로그인', onPress: () => router.replace('/(auth)/login') },
      ]);
    } catch (error: any) {
      let msg = '이메일 발송에 실패했습니다.';
      if (error.code === 'auth/user-not-found') {
        msg = '등록되지 않은 이메일입니다.';
      }
      Alert.alert('오류', msg);
    }
  };

  const resetState = () => {
    setFoundEmail(null);
    setFindPhone('');
    setFindName('');
    setResetEmail('');
  };

  return (
    <SafeAreaView style={styles.container}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <Text style={styles.backIcon}>←</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>회원 찾기</Text>
            <View style={{ width: 42 }} />
          </View>

          {/* Tab Bar */}
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tab, tab === 'email' && styles.tabActive]}
              onPress={() => { setTab('email'); resetState(); }}
            >
              <Text style={[styles.tabText, tab === 'email' && styles.tabTextActive]}>이메일 찾기</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, tab === 'password' && styles.tabActive]}
              onPress={() => { setTab('password'); resetState(); }}
            >
              <Text style={[styles.tabText, tab === 'password' && styles.tabTextActive]}>비밀번호 찾기</Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          <View style={styles.content}>
            {tab === 'email' ? (
              <>
                <Text style={styles.sectionTitle}>이메일 찾기</Text>
                <Text style={styles.sectionSubtitle}>가입 시 등록한 이름과 전화번호를 입력하세요</Text>

                {!foundEmail ? (
                  <>
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>이름</Text>
                      <TextInput
                        style={styles.inputSingle}
                        placeholder="이름을 입력하세요"
                        placeholderTextColor="#BDBDBD"
                        value={findName}
                        onChangeText={setFindName}
                      />
                    </View>
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>전화번호</Text>
                      <TextInput
                        style={styles.inputSingle}
                        placeholder="01012345678"
                        placeholderTextColor="#BDBDBD"
                        value={findPhone}
                        onChangeText={setFindPhone}
                        keyboardType="phone-pad"
                        maxLength={11}
                      />
                    </View>
                    <TouchableOpacity
                      style={[styles.actionButton, (!findName || findPhone.length < 10) && styles.actionButtonDisabled]}
                      onPress={handleFindEmail}
                      disabled={!findName || findPhone.length < 10}
                    >
                      <Text style={styles.actionButtonText}>이메일 찾기</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <View style={styles.resultBox}>
                    <View style={styles.resultIcon}>
                      <Text style={styles.resultEmoji}>✉</Text>
                    </View>
                    <Text style={styles.resultTitle}>이메일을 찾았습니다</Text>
                    <Text style={styles.resultEmail}>{foundEmail}</Text>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => router.replace('/(auth)/login')}
                    >
                      <Text style={styles.actionButtonText}>로그인하기</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.secondaryButton}
                      onPress={() => { setTab('password'); resetState(); }}
                    >
                      <Text style={styles.secondaryButtonText}>비밀번호 찾기</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            ) : (
              <>
                <Text style={styles.sectionTitle}>비밀번호 찾기</Text>
                <Text style={styles.sectionSubtitle}>
                  가입한 이메일을 입력하면 비밀번호 재설정 링크를 보내드립니다
                </Text>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>이메일</Text>
                  <TextInput
                    style={styles.inputSingle}
                    placeholder="가입한 이메일 입력"
                    placeholderTextColor="#BDBDBD"
                    value={resetEmail}
                    onChangeText={setResetEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>

                <TouchableOpacity
                  style={[styles.actionButton, !resetEmail.trim() && styles.actionButtonDisabled]}
                  onPress={handleResetPassword}
                  disabled={!resetEmail.trim()}
                >
                  <Text style={styles.actionButtonText}>재설정 메일 발송</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: {
    fontSize: 20,
    color: '#1A1A1A',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },

  // Tab Bar
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 28,
    backgroundColor: '#F5F5F5',
    borderRadius: 14,
    padding: 4,
    marginBottom: 24,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 11,
  },
  tabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9E9E9E',
  },
  tabTextActive: {
    color: '#1A1A1A',
  },

  // Content
  content: {
    flex: 1,
    paddingHorizontal: 28,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1A1A1A',
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#9E9E9E',
    marginBottom: 24,
    lineHeight: 20,
  },

  // Inputs
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  inputSingle: {
    backgroundColor: '#F5F5F5',
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 52,
    fontSize: 15,
    color: '#1A1A1A',
  },
  inputWithBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inputFlex: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 52,
    fontSize: 15,
    color: '#1A1A1A',
  },
  inlineBtn: {
    backgroundColor: '#0B9A61',
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inlineBtnSent: {
    backgroundColor: '#E0E0E0',
  },
  inlineBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Buttons
  actionButton: {
    backgroundColor: '#0B9A61',
    borderRadius: 16,
    paddingVertical: 17,
    alignItems: 'center',
    marginTop: 8,
  },
  actionButtonDisabled: {
    backgroundColor: '#E0E0E0',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  secondaryButton: {
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9E9E9E',
  },

  // Result
  resultBox: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  resultIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  resultEmoji: {
    fontSize: 28,
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  resultEmail: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0B9A61',
    marginBottom: 28,
  },

  // Hints
  errorHint: {
    fontSize: 12,
    color: '#FF6B6B',
    marginTop: 6,
  },
  successHint: {
    fontSize: 12,
    color: '#0B9A61',
    marginTop: 6,
  },
});

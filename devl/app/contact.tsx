import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

const FAQ_DATA = [
  { id: '1', q: '레시피를 어떻게 저장하나요?', a: '레시피 상세 페이지에서 북마크 아이콘을 눌러 저장할 수 있습니다. 저장된 레시피는 프로필의 저장 탭에서 확인할 수 있습니다.' },
  { id: '2', q: '커뮤니티에 레시피를 어떻게 올리나요?', a: '레시피 탭 하단의 + 버튼을 눌러 새 레시피를 작성할 수 있습니다. 제목, 재료, 조리 순서를 입력하면 됩니다.' },
  { id: '3', q: '프로필 사진을 변경할 수 있나요?', a: '프로필 페이지에서 프로필 편집 버튼을 눌러 사진을 변경할 수 있습니다.' },
  { id: '4', q: '비밀번호를 잊어버렸어요.', a: '로그인 페이지에서 "계정 찾기"를 눌러 이메일 또는 전화번호로 비밀번호를 재설정할 수 있습니다.' },
  { id: '5', q: '회원 탈퇴는 어떻게 하나요?', a: '프로필 > 메뉴 > 계정 섹션에서 회원탈퇴를 선택하시면 됩니다. 탈퇴 시 모든 데이터가 삭제됩니다.' },
];

export default function ContactScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'faq' | 'contact'>('faq');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleKakaoChannel = () => {
    Linking.openURL('https://pf.kakao.com/_nryMX/chat');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backBtn}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>고객센터</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'faq' && styles.tabActive]}
          onPress={() => setActiveTab('faq')}
        >
          <Text style={[styles.tabText, activeTab === 'faq' && styles.tabTextActive]}>자주 묻는 질문</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'contact' && styles.tabActive]}
          onPress={() => setActiveTab('contact')}
        >
          <Text style={[styles.tabText, activeTab === 'contact' && styles.tabTextActive]}>문의하기</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'faq' ? (
        <ScrollView showsVerticalScrollIndicator={false}>
          {FAQ_DATA.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.faqItem}
              activeOpacity={0.7}
              onPress={() => setExpandedId(expandedId === item.id ? null : item.id)}
            >
              <View style={styles.faqHeader}>
                <Text style={styles.faqQ}>Q</Text>
                <Text style={styles.faqQuestion}>{item.q}</Text>
                <Text style={styles.faqArrow}>{expandedId === item.id ? '∧' : '∨'}</Text>
              </View>
              {expandedId === item.id && (
                <View style={styles.faqAnswerBox}>
                  <Text style={styles.faqA}>A</Text>
                  <Text style={styles.faqAnswer}>{item.a}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
          <View style={{ height: 40 }} />
        </ScrollView>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, alignItems: 'center', justifyContent: 'center', flex: 1 }}>
          <Text style={{ fontSize: 48, marginBottom: 20 }}>💬</Text>
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#1A1A1A', marginBottom: 8, textAlign: 'center' }}>카카오톡으로 문의하기</Text>
          <Text style={{ fontSize: 14, color: '#888', lineHeight: 22, textAlign: 'center', marginBottom: 28 }}>
            궁금한 점이나 불편한 점이 있으시면{'\n'}카카오톡 채널 '요잘알'로 편하게 문의해 주세요.
          </Text>

          <TouchableOpacity style={styles.kakaoBtn} onPress={handleKakaoChannel}>
            <Text style={styles.kakaoBtnText}>카카오톡 채널 문의하기</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
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
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: '#1A1A1A' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#BBB' },
  tabTextActive: { color: '#1A1A1A' },
  faqItem: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0F0F0',
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  faqQ: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0B9A61',
    marginRight: 10,
  },
  faqQuestion: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#1A1A1A',
  },
  faqArrow: { fontSize: 14, color: '#CCC' },
  faqAnswerBox: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 16,
    paddingTop: 4,
  },
  faqA: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FF8C00',
    marginRight: 10,
  },
  faqAnswer: {
    flex: 1,
    fontSize: 14,
    color: '#666',
    lineHeight: 22,
  },
  kakaoBtn: {
    backgroundColor: '#FEE500',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 40,
    alignItems: 'center',
  },
  kakaoBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#191919',
  },
});

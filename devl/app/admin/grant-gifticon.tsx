import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, Alert, ActivityIndicator, TextInput,
  ScrollView, Image as RNImage, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { fetchAllUsers, adminGrantGifticon } from '../../services/api';
import type { UserProfile } from '../../services/api';

const defaultAvatarMale = require('../../assets/man.png');
const defaultAvatarFemale = require('../../assets/girl.png');
const isValidImageUri = (uri?: string) => !!uri && uri !== 'default' && (uri.startsWith('https://') || uri.startsWith('http://'));

function UserAvatar({ uri, gender }: { uri?: string; gender?: 'male' | 'female' | '' }) {
  const [errored, setErrored] = React.useState(false);
  const fallback = gender === 'female' ? defaultAvatarFemale : defaultAvatarMale;
  if (errored || !isValidImageUri(uri)) {
    return <RNImage source={fallback} style={styles.avatar} />;
  }
  return <RNImage source={{ uri }} style={styles.avatar} onError={() => setErrored(true)} />;
}

export default function AdminGrantGifticonScreen() {
  const router = useRouter();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selected, setSelected] = useState<UserProfile | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 폼 필드
  const [name, setName] = useState('스타벅스 카페 아메리카노 T');
  const [brand, setBrand] = useState('스타벅스');
  const [pinNo, setPinNo] = useState('');
  const [validPeriod, setValidPeriod] = useState('');
  const [couponImageUrl, setCouponImageUrl] = useState('');
  const [brandIcon, setBrandIcon] = useState('');
  const [trId, setTrId] = useState('');
  const [goodsCode, setGoodsCode] = useState('');
  const [grantReason, setGrantReason] = useState('레시피 작성 이벤트');

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return users.slice(0, 30);
    return users.filter(u =>
      (u.nickname || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.uid || '').toLowerCase().includes(q)
    ).slice(0, 50);
  }, [users, searchQuery]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAllUsers();
      setUsers(data);
    } catch {
      Alert.alert('오류', '유저 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const resetForm = () => {
    setPinNo('');
    setValidPeriod('');
    setCouponImageUrl('');
    setBrandIcon('');
    setTrId('');
    setGoodsCode('');
  };

  const handleSubmit = () => {
    if (!selected) return;
    if (!name.trim()) { Alert.alert('확인', '기프티콘 이름을 입력해주세요.'); return; }
    if (!pinNo.trim()) { Alert.alert('확인', '교환 번호(PIN)를 입력해주세요.'); return; }

    Alert.alert(
      '기프티콘 발급',
      `${selected.nickname}님에게\n"${name}" 기프티콘을 발급할까요?\n\n포인트는 차감되지 않습니다.`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '발급',
          style: 'default',
          onPress: async () => {
            setSubmitting(true);
            try {
              await adminGrantGifticon({
                uid: selected.uid,
                name: name.trim(),
                brand: brand.trim() || undefined,
                brandIcon: brandIcon.trim() || undefined,
                couponImageUrl: couponImageUrl.trim() || undefined,
                pinNo: pinNo.trim(),
                validPeriod: validPeriod.trim() || undefined,
                trId: trId.trim() || undefined,
                goodsCode: goodsCode.trim() || undefined,
                grantReason: grantReason.trim() || undefined,
              });
              Alert.alert('완료', `${selected.nickname}님에게 기프티콘이 발급됐어요.`, [
                { text: '확인', onPress: () => { resetForm(); setSelected(null); } },
              ]);
            } catch (e: any) {
              Alert.alert('실패', e?.message || '기프티콘 발급에 실패했습니다.');
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <View style={styles.titleWrap} pointerEvents="none">
          <Text style={styles.title}>기프티콘 발급</Text>
        </View>
        <View style={styles.headerBtn} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {!selected ? (
          <View style={{ flex: 1 }}>
            <View style={styles.searchRow}>
              <Ionicons name="search-outline" size={18} color="#999" />
              <TextInput
                style={styles.searchInput}
                placeholder="닉네임, 이메일, UID로 검색"
                placeholderTextColor="#BBB"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCorrect={false}
                autoCapitalize="none"
              />
            </View>

            {loading ? (
              <ActivityIndicator style={{ marginTop: 40 }} color="#1A1A1A" />
            ) : (
              <FlatList
                data={filteredUsers}
                keyExtractor={(item) => item.uid}
                contentContainerStyle={{ paddingBottom: 40 }}
                ListEmptyComponent={
                  <Text style={styles.empty}>검색 결과가 없어요.</Text>
                }
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.userRow}
                    activeOpacity={0.7}
                    onPress={() => setSelected(item)}
                  >
                    <UserAvatar uri={item.profileImage} gender={item.gender as any} />
                    <View style={styles.userInfo}>
                      <Text style={styles.userName} numberOfLines={1}>{item.nickname}</Text>
                      <Text style={styles.userSub} numberOfLines={1}>{item.email}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#BDBDBD" />
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        ) : (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 80 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* 선택된 사용자 카드 */}
            <View style={styles.selectedCard}>
              <UserAvatar uri={selected.profileImage} gender={selected.gender as any} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.userName}>{selected.nickname}</Text>
                <Text style={styles.userSub}>{selected.email}</Text>
                <Text style={styles.userUid} numberOfLines={1}>UID: {selected.uid}</Text>
              </View>
              <TouchableOpacity onPress={() => setSelected(null)} style={styles.changeBtn}>
                <Text style={styles.changeBtnText}>변경</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>기프티콘 정보</Text>

              <Field label="이름 *" value={name} onChangeText={setName} placeholder="예: 스타벅스 카페 아메리카노 T" />
              <Field label="브랜드" value={brand} onChangeText={setBrand} placeholder="예: 스타벅스" />
              <Field
                label="교환 번호 (PIN) *"
                value={pinNo}
                onChangeText={setPinNo}
                placeholder="예: 1234-5678-9012-3456"
                keyboardType="numbers-and-punctuation"
              />
              <Field
                label="유효기간"
                value={validPeriod}
                onChangeText={setValidPeriod}
                placeholder="예: 2026.12.31"
              />
              <Field
                label="쿠폰 이미지 URL"
                value={couponImageUrl}
                onChangeText={setCouponImageUrl}
                placeholder="https://..."
                autoCapitalize="none"
              />
              <Field
                label="브랜드 아이콘 URL"
                value={brandIcon}
                onChangeText={setBrandIcon}
                placeholder="https://..."
                autoCapitalize="none"
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>기프티쇼 메타데이터 (선택)</Text>
              <Text style={styles.sectionSub}>
                기프티쇼 비즈에서 발급된 상품 코드/거래 ID. 입력하면 사용 상태 자동 동기화에 사용됩니다.
              </Text>
              <Field label="trId" value={trId} onChangeText={setTrId} placeholder="기프티쇼 거래 ID" autoCapitalize="none" />
              <Field label="goodsCode" value={goodsCode} onChangeText={setGoodsCode} placeholder="기프티쇼 상품 코드" autoCapitalize="none" />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>발급 사유 (메모)</Text>
              <Field
                label=""
                value={grantReason}
                onChangeText={setGrantReason}
                placeholder="예: 레시피 작성 이벤트"
                noLabel
              />
            </View>

            <TouchableOpacity
              style={[styles.submitBtn, submitting && { opacity: 0.5 }]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitBtnText}>{selected.nickname}님에게 발급하기</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: any;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  noLabel?: boolean;
}) {
  return (
    <View style={styles.fieldWrap}>
      {!props.noLabel && <Text style={styles.fieldLabel}>{props.label}</Text>}
      <TextInput
        style={styles.input}
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        placeholderTextColor="#BBB"
        keyboardType={props.keyboardType}
        autoCapitalize={props.autoCapitalize}
        autoCorrect={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F0F0F0',
    position: 'relative',
  },
  headerBtn: { width: 32 },
  titleWrap: {
    position: 'absolute',
    left: 0, right: 0, top: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 17, fontWeight: '700', color: '#1A1A1A' },

  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginTop: 12,
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: '#F5F5F5', borderRadius: 10,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#1A1A1A', padding: 0 },

  empty: { textAlign: 'center', color: '#BBB', marginTop: 60, fontSize: 13 },

  userRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F5F5F5',
  },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F5F5F5' },
  userInfo: { flex: 1, marginLeft: 12 },
  userName: { fontSize: 15, fontWeight: '700', color: '#1A1A1A' },
  userSub: { fontSize: 12, color: '#999', marginTop: 2 },
  userUid: { fontSize: 11, color: '#BBB', marginTop: 2 },

  selectedCard: {
    flexDirection: 'row', alignItems: 'center',
    margin: 16, padding: 16,
    backgroundColor: '#F0FAF5', borderRadius: 14,
  },
  changeBtn: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: '#1BAE74', borderRadius: 16,
  },
  changeBtnText: { fontSize: 12, fontWeight: '700', color: '#1BAE74' },

  section: {
    paddingHorizontal: 16, paddingVertical: 16,
    borderTopWidth: 8, borderTopColor: '#F8F8F8',
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1A1A1A', marginBottom: 4 },
  sectionSub: { fontSize: 12, color: '#999', marginBottom: 12, lineHeight: 18 },

  fieldWrap: { marginTop: 12 },
  fieldLabel: { fontSize: 13, color: '#555', marginBottom: 6, fontWeight: '600' },
  input: {
    borderWidth: 1, borderColor: '#E5E5E5', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 12,
    fontSize: 14, color: '#1A1A1A',
  },

  submitBtn: {
    marginHorizontal: 16, marginTop: 24,
    backgroundColor: '#1BAE74', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});

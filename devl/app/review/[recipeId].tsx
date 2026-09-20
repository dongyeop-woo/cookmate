import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  ScrollView,
  Platform,
  Alert,
  Modal,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { fetchReviewsByRecipe, deleteReview, getCookingRecord, type Review } from '../../services/api';
import { useAuth } from '../_layout';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

type SortMode = 'recent' | 'oldest';

export default function ReviewListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { firebaseUser, userProfile } = useAuth();
  const blockedUids = ((userProfile as any)?.blockedUids ?? []) as string[];
  const { recipeId, recipeTitle, authorUid } = useLocalSearchParams<{ recipeId: string; recipeTitle?: string; authorUid?: string }>();
  const isOwnRecipe = !!firebaseUser?.uid && !!authorUid && firebaseUser.uid === authorUid;
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortMode, setSortMode] = useState<SortMode>('recent');
  const [photoOnly, setPhotoOnly] = useState(false);
  const [expandedPhoto, setExpandedPhoto] = useState<string | null>(null);
  const [detailReview, setDetailReview] = useState<Review | null>(null);
  const [cookedAt, setCookedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!recipeId) return;
    try {
      const data = await fetchReviewsByRecipe(recipeId);
      setReviews(data.filter(r => !blockedUids.includes(r.uid)));
    } catch (_) {
      setReviews([]);
    } finally {
      setLoading(false);
    }
  }, [recipeId]);

  const loadCookedStatus = useCallback(async () => {
    if (!recipeId || !firebaseUser?.uid) {
      setCookedAt(null);
      return;
    }
    const rec = await getCookingRecord(firebaseUser.uid, recipeId);
    setCookedAt(rec.cooked && rec.cookedAt ? rec.cookedAt : null);
  }, [recipeId, firebaseUser?.uid]);

  useFocusEffect(useCallback(() => { load(); loadCookedStatus(); }, [load, loadCookedStatus]));

  const alreadyReviewed = useMemo(() => {
    if (!firebaseUser?.uid) return false;
    return reviews.some(r => r.uid === firebaseUser.uid);
  }, [reviews, firebaseUser?.uid]);

  // 본인 레시피에는 후기 작성 초대 카드 표시 안 함
  const showInviteCard = !!cookedAt && !alreadyReviewed && !isOwnRecipe;

  const formatCookedDate = (iso: string) => {
    const d = new Date(iso);
    return `${String(d.getMonth() + 1).padStart(2, '0')}월 ${String(d.getDate()).padStart(2, '0')}일`;
  };

  const goWriteReview = (prefillRating?: number) => {
    router.push({
      pathname: '/review/write',
      params: {
        recipeId: recipeId as string,
        recipeTitle,
        ...(prefillRating ? { initialRating: String(prefillRating) } : {}),
      },
    });
  };

  const formatDate = (iso: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  };

  const avgRating = useMemo(() => {
    const rated = reviews.filter(r => r.rating && r.rating > 0);
    if (rated.length === 0) return 0;
    return rated.reduce((s, r) => s + (r.rating || 0), 0) / rated.length;
  }, [reviews]);

  const photoGallery = useMemo(() => reviews.filter(r => r.photoUrl).slice(0, 20), [reviews]);

  const sortedReviews = useMemo(() => {
    let list = photoOnly ? reviews.filter(r => !!r.photoUrl) : reviews;
    if (sortMode === 'oldest') {
      list = [...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    } else {
      list = [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
    return list;
  }, [reviews, sortMode, photoOnly]);

  const renderStars = (rating: number, size = 16) => (
    <View style={{ flexDirection: 'row' }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Ionicons
          key={n}
          name={rating >= n ? 'star' : rating >= n - 0.5 ? 'star-half' : 'star-outline'}
          size={size}
          color="#FFB800"
        />
      ))}
    </View>
  );

  const handleEdit = (item: Review) => {
    router.push({
      pathname: '/review/write',
      params: {
        recipeId: item.recipeId,
        recipeTitle,
        reviewId: item.id,
        initialContent: item.content,
        initialRating: String(item.rating || 0),
        initialPhotoUrl: item.photoUrl,
      },
    });
  };

  const handleDelete = (item: Review) => {
    Alert.alert('후기 삭제', '정말 삭제하시겠어요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteReview(item.id);
            setReviews(prev => prev.filter(r => r.id !== item.id));
          } catch (e: any) {
            Alert.alert('삭제 실패', e.message || '잠시 후 다시 시도해주세요.');
          }
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: Review }) => {
    const isOwner = firebaseUser?.uid === item.uid;
    return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        {item.authorProfileImage && item.authorProfileImage !== 'default' ? (
          <Image source={{ uri: item.authorProfileImage }} style={styles.avatar} cachePolicy="disk" />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarText}>{(item.authorNickname || '?').charAt(0)}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.nickname}>{item.authorNickname || '익명'}</Text>
            <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
          </View>
          <View style={{ marginTop: 4 }}>
            {renderStars(item.rating || 0, 13)}
          </View>
        </View>
        {isOwner && (
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <TouchableOpacity onPress={() => handleEdit(item)} hitSlop={8} style={styles.ownerBtn}>
              <Text style={styles.ownerBtnText}>수정</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleDelete(item)} hitSlop={8} style={styles.ownerBtn}>
              <Text style={[styles.ownerBtnText, { color: '#FF3B30' }]}>삭제</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {recipeTitle ? (
        <Text style={styles.recipeTag} numberOfLines={1}>{recipeTitle}</Text>
      ) : null}

      {item.photoUrl ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.photoStrip}
          contentContainerStyle={{ gap: 4 }}
        >
          <TouchableOpacity activeOpacity={0.9} onPress={() => setDetailReview(item)}>
            <Image source={{ uri: item.photoUrl }} style={styles.photoThumb} contentFit="cover" cachePolicy="disk" />
          </TouchableOpacity>
        </ScrollView>
      ) : null}

      <Text style={styles.content}>{item.content}</Text>
    </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>레시피 후기</Text>
        <View style={styles.backBtn} />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} color="#1A1A1A" />
      ) : (
        <FlatList
          data={sortedReviews}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          contentContainerStyle={{ paddingBottom: 110 }}
          ListHeaderComponent={
            <View>
              {/* 평점 요약 */}
              <View style={styles.summaryBox}>
                <View style={{ flex: 1 }}>
                  {renderStars(avgRating, 22)}
                </View>
                <Text style={styles.countText}>{reviews.length}</Text>
              </View>

              {/* 사진 갤러리 */}
              {photoGallery.length > 0 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.gallery}
                  contentContainerStyle={{ paddingHorizontal: 16, gap: 6 }}
                >
                  {photoGallery.map((r) => (
                    <TouchableOpacity key={r.id} activeOpacity={0.8} onPress={() => setDetailReview(r)}>
                      <Image source={{ uri: r.photoUrl }} style={styles.galleryItem} contentFit="cover" cachePolicy="disk" />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              {/* 요리 완료 후 리뷰 유도 카드 */}
              {showInviteCard && cookedAt && (
                <View style={styles.inviteCard}>
                  <Text style={styles.inviteDate}>{formatCookedDate(cookedAt)}에 요리한 이 레시피</Text>
                  <View style={styles.inviteStars}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <TouchableOpacity
                        key={n}
                        onPress={() => goWriteReview(n)}
                        activeOpacity={0.7}
                        hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                      >
                        <Ionicons name="star-outline" size={34} color="#C8C8C8" style={{ marginHorizontal: 3 }} />
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={styles.inviteSub}>별점을 남겨주시면 큰 도움이 돼요.</Text>
                </View>
              )}

              {/* 필터 바 */}
              <View style={styles.filterBar}>
                <View style={styles.sortTabs}>
                  <TouchableOpacity onPress={() => setSortMode('recent')}>
                    <Text style={[styles.sortTab, sortMode === 'recent' && styles.sortTabActive]}>최신순</Text>
                  </TouchableOpacity>
                  <Text style={styles.sortDivider}>|</Text>
                  <TouchableOpacity onPress={() => setSortMode('oldest')}>
                    <Text style={[styles.sortTab, sortMode === 'oldest' && styles.sortTabActive]}>오래된순</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  style={styles.filterCheck}
                  onPress={() => setPhotoOnly(v => !v)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.checkbox, photoOnly && styles.checkboxOn]}>
                    {photoOnly && <Ionicons name="checkmark" size={12} color="#FFFFFF" />}
                  </View>
                  <Text style={styles.filterCheckText}>사진 후기</Text>
                </TouchableOpacity>
              </View>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="restaurant-outline" size={56} color="#DDD" />
              <Text style={styles.emptyText}>아직 후기가 없어요</Text>
              <Text style={styles.emptySub}>첫 후기를 남기고 20P를 받아보세요!</Text>
            </View>
          }
        />
      )}

      {/* 이미지 확대 모달 */}
      <Modal
        visible={!!expandedPhoto}
        transparent
        animationType="fade"
        onRequestClose={() => setExpandedPhoto(null)}
        statusBarTranslucent
      >
        <View style={styles.zoomOverlay}>
          <TouchableOpacity
            style={styles.zoomClose}
            onPress={() => setExpandedPhoto(null)}
            hitSlop={10}
          >
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
            activeOpacity={1}
            onPress={() => setExpandedPhoto(null)}
          >
            {expandedPhoto && (
              <Image
                source={{ uri: expandedPhoto }}
                style={styles.zoomImage}
                contentFit="contain"
                cachePolicy="disk"
              />
            )}
          </TouchableOpacity>
        </View>
      </Modal>

      {/* 후기 상세 모달 */}
      <Modal
        visible={!!detailReview}
        animationType="slide"
        onRequestClose={() => setDetailReview(null)}
        presentationStyle="fullScreen"
      >
        <SafeAreaView style={styles.detailOverlay} edges={['top', 'bottom']}>
          <View style={styles.detailHeader}>
            <TouchableOpacity onPress={() => setDetailReview(null)} hitSlop={10} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={22} color="#1A1A1A" />
            </TouchableOpacity>
            <Text style={styles.topBarTitle}>후기 상세</Text>
            <View style={styles.backBtn} />
          </View>
          {detailReview && (
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingBottom: 40 }}
              showsVerticalScrollIndicator={false}
            >
              {/* 작성자 */}
              <View style={styles.detailUserRow}>
                {detailReview.authorProfileImage && detailReview.authorProfileImage !== 'default' ? (
                  <Image source={{ uri: detailReview.authorProfileImage }} style={styles.detailAvatar} cachePolicy="disk" />
                ) : (
                  <View style={[styles.detailAvatar, styles.avatarPlaceholder]}>
                    <Text style={styles.avatarText}>{(detailReview.authorNickname || '?').charAt(0)}</Text>
                  </View>
                )}
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.detailNickname}>{detailReview.authorNickname || '익명'}</Text>
                  {renderStars(detailReview.rating || 0, 14)}
                </View>
                <Text style={styles.detailDate}>{formatDate(detailReview.createdAt)}</Text>
              </View>

              {/* 사진 */}
              {detailReview.photoUrl && (
                <Image
                  source={{ uri: detailReview.photoUrl }}
                  style={styles.detailPhoto}
                  contentFit="cover"
                  cachePolicy="disk"
                />
              )}

              {/* 본문 */}
              <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
                {recipeTitle && <Text style={styles.recipeTag}>{recipeTitle}</Text>}
                <Text style={styles.detailContent}>{detailReview.content}</Text>
              </View>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 8 : 4,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0F0F0',
  },
  topBarTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A1A' },
  backBtn: {
    width: 42,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // 평점 요약
  summaryBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  countText: { fontSize: 28, fontWeight: '800', color: '#1A1A1A' },

  // 갤러리
  gallery: { paddingVertical: 4 },
  galleryItem: {
    width: 80,
    height: 80,
    borderRadius: 6,
    backgroundColor: '#EFEFEF',
  },

  // 리뷰 유도 카드
  inviteCard: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    paddingVertical: 22,
    paddingHorizontal: 16,
    backgroundColor: '#F6F7F8',
    borderRadius: 14,
    alignItems: 'center',
  },
  inviteDate: {
    fontSize: 13,
    color: '#9A9A9A',
    marginBottom: 4,
  },
  inviteTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1A1A1A',
    marginBottom: 14,
  },
  inviteStars: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  inviteSub: {
    fontSize: 13,
    color: '#666',
  },

  // 필터 바
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 8,
    borderTopWidth: 6,
    borderTopColor: '#F5F5F5',
  },
  sortTabs: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sortTab: { fontSize: 14, color: '#BDBDBD', fontWeight: '600' },
  sortTabActive: { color: '#1A1A1A', fontWeight: '700' },
  sortDivider: { color: '#E5E5E5', fontSize: 12 },
  filterCheck: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#CCC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxOn: { backgroundColor: '#1A1A1A', borderColor: '#1A1A1A' },
  filterCheckText: { fontSize: 13, color: '#1A1A1A', fontWeight: '500' },

  // 카드
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: '#EEE', marginHorizontal: 16 },
  card: { paddingHorizontal: 16, paddingVertical: 18, backgroundColor: '#FFFFFF' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EEE',
  },
  avatarPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 14, fontWeight: '700', color: '#666' },
  nickname: { fontSize: 13, fontWeight: '700', color: '#1A1A1A' },
  date: { fontSize: 12, color: '#999' },
  recipeTag: {
    fontSize: 12,
    color: '#888',
    marginTop: 10,
    marginBottom: 4,
  },
  photoStrip: { marginTop: 10, marginHorizontal: -2 },
  photoThumb: {
    width: 100,
    height: 100,
    borderRadius: 6,
    backgroundColor: '#EFEFEF',
  },
  content: { fontSize: 14, color: '#333', lineHeight: 21, marginTop: 10 },
  ownerBtn: { paddingHorizontal: 6, paddingVertical: 4 },
  ownerBtnText: { fontSize: 12, color: '#666', fontWeight: '600' },
  replyBox: {
    marginTop: 12,
    backgroundColor: '#F7FFF9',
    borderLeftWidth: 3,
    borderLeftColor: '#1A1A1A',
    padding: 12,
    borderRadius: 6,
  },
  replyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  replyAuthor: { fontSize: 13, fontWeight: '700', color: '#1A1A1A' },
  replyBadge: {
    fontSize: 10,
    color: '#1A1A1A',
    backgroundColor: '#E0F5EA',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontWeight: '700',
  },
  replyContent: { fontSize: 13, color: '#333', lineHeight: 19 },
  replyActionText: { fontSize: 12, color: '#666', fontWeight: '600' },
  replyInputBox: {
    marginTop: 12,
    backgroundColor: '#FAFAFA',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EEE',
  },
  replyInput: {
    fontSize: 13,
    color: '#1A1A1A',
    minHeight: 50,
    textAlignVertical: 'top',
  },

  // 빈 상태 / FAB
  empty: { alignItems: 'center', paddingVertical: 60, gap: 6 },
  emptyText: { fontSize: 15, color: '#666', fontWeight: '600', marginTop: 8 },
  emptySub: { fontSize: 13, color: '#999' },
  fab: {
    position: 'absolute',
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1BAE74',
    paddingVertical: 16,
    borderRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6,
  },
  fabText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },

  zoomOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
  },
  zoomClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomImage: {
    width: SCREEN_W,
    height: SCREEN_H,
  },
  detailOverlay: { flex: 1, backgroundColor: '#FFFFFF' },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0F0F0',
  },
  detailUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  detailAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EEE',
  },
  detailNickname: { fontSize: 14, fontWeight: '700', color: '#1A1A1A', marginBottom: 4 },
  detailDate: { fontSize: 12, color: '#999' },
  detailPhoto: {
    width: SCREEN_W,
    height: SCREEN_W,
    backgroundColor: '#000',
  },
  detailContent: { fontSize: 15, color: '#1A1A1A', lineHeight: 22, marginTop: 12 },
});

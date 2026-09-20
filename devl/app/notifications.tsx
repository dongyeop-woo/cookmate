import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SectionList,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from './_layout';
import {
  fetchServerNotifications,
  fetchUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsReadServer,
  type ServerNotification,
} from '../services/api';

type NotifCategory = 'all' | 'follow' | 'comment' | 'review' | 'like' | 'point' | 'event' | 'gifticon';

type CategoryStyle = { icon: string; iconColor: string; iconBg: string };

const CATEGORY_STYLES: Record<string, CategoryStyle> = {
  comment: { icon: 'help-circle-outline', iconColor: '#9E9E9E', iconBg: '#F5F5F5' },
  like: { icon: 'heart', iconColor: '#FF6B6B', iconBg: '#FFF0F0' },
  review: { icon: 'star', iconColor: '#FFB800', iconBg: '#FFF8E1' },
  follow: { icon: 'person-add', iconColor: '#1A1A1A', iconBg: '#F5F5F5' },
  event: { icon: 'gift', iconColor: '#FF9800', iconBg: '#FFF3E0' },
  point: { icon: 'app-icon', iconColor: '#1A1A1A', iconBg: '#F5F5F5' },
  gifticon: { icon: 'app-icon', iconColor: '#1A1A1A', iconBg: '#F5F5F5' },
  refund: { icon: 'cash-outline', iconColor: '#4CAF50', iconBg: '#E8F5E9' },
  recipe: { icon: 'restaurant-outline', iconColor: '#0B9A61', iconBg: '#E8F5EF' },
  inquiry: { icon: 'chatbox-ellipses-outline', iconColor: '#1A1A1A', iconBg: '#F5F5F5' },
  system: { icon: 'app-icon', iconColor: '#1A1A1A', iconBg: '#F5F5F5' },
};

function getCategoryStyle(category: string): CategoryStyle {
  return CATEGORY_STYLES[category] || CATEGORY_STYLES.system;
}

/**
 * 백엔드 category가 누락되었거나 'system'인 legacy 알림은 제목으로 카테고리 추론.
 * 신규 알림은 백엔드가 명시적으로 전송하므로 이 fallback 안 거침.
 */
function resolveCategory(category: string, title: string): string {
  if (category && category !== 'system') return category;
  if (!title) return 'system';
  if (title.includes('좋아요')) return 'like';
  if (title.includes('팔로워') || title.includes('팔로우')) return 'follow';
  if (title.includes('후기') || title.includes('답글')) return 'review';
  if (title.includes('댓글') || title.includes('질문')) return 'comment';
  if (title.includes('환불')) return 'refund';
  if (title.includes('기프티콘')) return 'gifticon';
  if (title.includes('레시피') && (title.includes('승인') || title.includes('반려'))) return 'recipe';
  if (title.includes('문의')) return 'inquiry';
  if (title.includes('포인트') || title.includes('보너스') || title.includes('이벤트')) return 'point';
  return 'system';
}

/** 알림 화면 카테고리 탭 매핑 — 백엔드 카테고리를 UI 탭에 매핑 */
function tabMatches(activeTab: NotifCategory, notifCategory: string): boolean {
  if (activeTab === 'all') return true;
  return activeTab === notifCategory;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { firebaseUser } = useAuth();
  const [notifications, setNotifications] = useState<ServerNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCategory, setActiveCategory] = useState<NotifCategory>('all');

  const load = useCallback(async () => {
    try {
      const uid = firebaseUser?.uid;
      if (!uid) return;
      const list = await fetchServerNotifications(uid);
      setNotifications(list);
    } catch (e) {
      console.warn('알림 로드 실패:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [firebaseUser?.uid]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const handlePress = async (item: ServerNotification) => {
    // optimistic — UI 즉시 반영
    if (!item.read) {
      setNotifications(prev => prev.map(n => n.id === item.id ? { ...n, read: true } : n));
      markNotificationRead(item.id);
    }
    if (item.route) router.push(item.route as any);
  };

  const handleMarkAll = async () => {
    if (!firebaseUser?.uid) return;
    if (notifications.every(n => n.read)) return;
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    markAllNotificationsReadServer(firebaseUser.uid);
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return '방금 전';
    if (mins < 60) return `${mins}분 전`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}시간 전`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}일 전`;
    return `${d.getMonth() + 1}월 ${d.getDate()}일`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap} pointerEvents="none">
          <Text style={styles.headerTitle}>알림</Text>
        </View>
        {notifications.some(n => !n.read) ? (
          <TouchableOpacity onPress={handleMarkAll} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.markAllText}>모두 읽기</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 24 }} />
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryTabsWrap} contentContainerStyle={styles.categoryTabs}>
        {([
          { key: 'all', label: '전체' },
          { key: 'review', label: '후기' },
          { key: 'comment', label: '질문' },
          { key: 'like', label: '좋아요' },
          { key: 'follow', label: '팔로우' },
          { key: 'point', label: '포인트' },
          { key: 'event', label: '이벤트' },
          { key: 'gifticon', label: '기프티콘' },
        ] as { key: NotifCategory; label: string }[]).map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.categoryTab, activeCategory === tab.key && styles.categoryTabActive]}
            onPress={() => setActiveCategory(tab.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.categoryTabText, activeCategory === tab.key && styles.categoryTabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} color="#1A1A1A" />
      ) : (
        <SectionList
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1A1A1A" />}
          sections={(() => {
            const now = Date.now();
            const DAY = 24 * 60 * 60 * 1000;
            const filtered = notifications.filter(n => tabMatches(activeCategory, resolveCategory(n.category, n.title)));
            const buckets: Record<string, ServerNotification[]> = { '오늘': [], '어제': [], '이번 주': [], '이전': [] };
            for (const n of filtered) {
              const diff = now - new Date(n.createdAt).getTime();
              if (diff < DAY) buckets['오늘'].push(n);
              else if (diff < 2 * DAY) buckets['어제'].push(n);
              else if (diff < 7 * DAY) buckets['이번 주'].push(n);
              else buckets['이전'].push(n);
            }
            return Object.entries(buckets)
              .filter(([, arr]) => arr.length > 0)
              .map(([title, data]) => ({ title, data }));
          })()}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section: { title } }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderText}>{title}</Text>
            </View>
          )}
          renderItem={({ item }) => {
            const resolvedCategory = resolveCategory(item.category, item.title);
            const style = getCategoryStyle(resolvedCategory);
            return (
              <TouchableOpacity
                style={[styles.notifRow, !item.read && styles.notifRowUnread]}
                activeOpacity={item.route ? 0.7 : 1}
                disabled={!item.route}
                onPress={() => handlePress(item)}
              >
                {item.imageUrl ? (
                  <View style={styles.notifIcon}>
                    <Image source={{ uri: item.imageUrl }} style={{ width: '100%', height: '100%', borderRadius: 20 }} contentFit="cover" />
                  </View>
                ) : style.icon === 'app-icon' ? (
                  <View style={[styles.notifIcon, { backgroundColor: '#FFFFFF' }]}>
                    <Image source={require('../assets/icon.png')} style={{ width: 28, height: 28 }} contentFit="contain" />
                  </View>
                ) : (
                  <View style={[styles.notifIcon, { backgroundColor: style.iconBg }]}>
                    <Ionicons name={style.icon as any} size={20} color={style.iconColor} />
                  </View>
                )}
                <View style={styles.notifContent}>
                  <Text style={styles.notifTitle}>{item.title}</Text>
                  <Text style={styles.notifBody} numberOfLines={2}>{item.body}</Text>
                  <Text style={styles.notifDate}>{formatDate(item.createdAt)}</Text>
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="notifications-off-outline" size={52} color="#E0E0E0" />
              <Text style={styles.emptyText}>아직 알림이 없어요</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

/** 다른 화면에서 모두 읽음 호출 (홈 탭 진입 시 등). 백엔드 호출만, 캐시 없음. */
export async function markAllNotificationsRead(uid: string, _nickname?: string): Promise<void> {
  await markAllNotificationsReadServer(uid);
}

/** 홈 탭 배지용 안 읽은 알림 카운트. */
export async function getUnreadCount(uid: string, _nickname?: string): Promise<number> {
  return fetchUnreadNotificationCount(uid);
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0F0F0',
  },
  headerTitleWrap: {
    position: 'absolute',
    left: 0, right: 0, top: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A1A' },
  markAllText: { fontSize: 13, color: '#1A1A1A', fontWeight: '600' },
  categoryTabsWrap: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0F0F0',
    flexGrow: 0,
    flexShrink: 0,
  },
  categoryTabs: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
    alignItems: 'center',
  },
  categoryTab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
  },
  categoryTabActive: {
    backgroundColor: '#1A1A1A',
  },
  categoryTabText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  categoryTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  sectionHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
    backgroundColor: '#FFFFFF',
  },
  sectionHeaderText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#9E9E9E',
    letterSpacing: -0.2,
  },
  notifRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F5F5F5',
    backgroundColor: '#FFFFFF',
  },
  notifRowUnread: {
    backgroundColor: '#F7F9FB',
  },
  notifIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  notifContent: {
    flex: 1,
  },
  notifTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 3,
  },
  notifBody: {
    fontSize: 13,
    color: '#666',
    lineHeight: 19,
    marginBottom: 4,
  },
  notifDate: {
    fontSize: 12,
    color: '#BDBDBD',
  },
  empty: {
    alignItems: 'center',
    paddingTop: 80,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    color: '#BDBDBD',
  },
});

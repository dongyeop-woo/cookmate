import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

const ANNOUNCEMENTS = [
  {
    id: '1',
    title: '요잘알 앱 출시 안내',
    date: '2026.04.01',
    content: '안녕하세요! 요잘알이 정식 출시되었습니다. 다양한 레시피를 만나보세요. 앞으로도 더 좋은 서비스로 찾아뵙겠습니다.',
    isNew: true,
  },
  {
    id: '2',
    title: '커뮤니티 기능 업데이트',
    date: '2026.04.01',
    content: '커뮤니티에서 나만의 레시피를 공유하고, 다른 요리사들의 레시피에 좋아요와 평점을 남길 수 있습니다.',
    isNew: true,
  },
  {
    id: '3',
    title: '서비스 이용약관 안내',
    date: '2026.03.28',
    content: '요잘알 서비스 이용약관이 게시되었습니다. 프로필 메뉴에서 확인하실 수 있습니다.',
    isNew: false,
  },
];

export default function AnnouncementsScreen() {
  const router = useRouter();
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backBtn}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>공지사항</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {ANNOUNCEMENTS.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.item}
            activeOpacity={0.7}
            onPress={() => setExpandedId(expandedId === item.id ? null : item.id)}
          >
            <View style={styles.itemHeader}>
              <View style={styles.itemTitleRow}>
                {item.isNew && <View style={styles.newBadge}><Text style={styles.newBadgeText}>N</Text></View>}
                <Text style={styles.itemTitle} numberOfLines={expandedId === item.id ? undefined : 1}>{item.title}</Text>
              </View>
              <Text style={styles.itemDate}>{item.date}</Text>
            </View>
            {expandedId === item.id && (
              <Text style={styles.itemContent}>{item.content}</Text>
            )}
          </TouchableOpacity>
        ))}
        <View style={{ height: 40 }} />
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
  item: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0F0F0',
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  newBadge: {
    backgroundColor: '#FF3B30',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    marginRight: 8,
  },
  newBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
    flex: 1,
  },
  itemDate: {
    fontSize: 13,
    color: '#BBB',
  },
  itemContent: {
    fontSize: 14,
    color: '#666',
    lineHeight: 22,
    marginTop: 12,
  },
});

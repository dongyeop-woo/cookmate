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
import { Ionicons } from '@expo/vector-icons';

const ANNOUNCEMENTS = [
  {
    id: '6',
    title: '홈 화면 레시피 섹션 선정 기준 안내',
    date: '2026.04.19',
    content: '요잘알 홈 화면에 노출되는 레시피 섹션의 선정 기준을 투명하게 공개합니다.\n\n■ 베스트 레시피\n전체 레시피 중 좋아요 수가 많은 순서대로 상위 10개를 보여줍니다. (실시간 갱신)\n\n■ 추천 레시피\n매일 00시에 무작위로 6개의 레시피가 선정돼요. 같은 날에는 모든 유저에게 동일한 추천이 노출됩니다.\n\n■ 인기 셰프 레시피\n팔로워 수가 많은 셰프 순으로 선정되며, 팔로워 수가 같으면 닉네임 가나다순으로 정렬됩니다. 각 셰프는 본인이 작성한 레시피 중 좋아요가 가장 많은 1개만 노출되며, 총 4명·4개가 표시돼요.\n\n■ 초스피드 요리\n조리 시간 15분 이하의 레시피를 시간이 짧은 순으로 최대 6개 보여줍니다.\n\n■ 인기 간식\n카테고리가 "간식" 또는 "디저트"에 해당하는 레시피 중 최대 6개를 보여줍니다.\n\n■ 이번 주 레시피\n매주 월요일 00시에 무작위로 6개의 레시피가 새로 선정됩니다.\n\n※ 선정 기준은 서비스 개선을 위해 사전 공지 없이 조정될 수 있습니다.',
    isNew: true,
  },
  {
    id: '5',
    title: '카카오 채널 친구 추가하고 500P 받기!',
    date: '2026.05.01',
    content: '요잘알 카카오 채널을 친구 추가하면 500 포인트를 즉시 드려요!\n\n참여 방법:\n1. 이벤트 페이지에서 카카오 채널 친구 추가\n2. 포인트 받기 버튼 클릭\n3. 500P 즉시 지급!\n\n• 카카오 로그인 유저만 참여 가능\n• 1인 1회 한정\n• 선착순 1,000명 소진 시 조기 종료',
    isNew: true,
    route: '/event-kakao',
  },
];

export default function AnnouncementsScreen() {
  const router = useRouter();
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
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
            onPress={() => (item as any).route ? router.push((item as any).route) : setExpandedId(expandedId === item.id ? null : item.id)}
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

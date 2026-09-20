import { Tabs } from 'expo-router';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const icons: IconName[] = ['home-outline', 'grid-outline', 'bag-outline', 'person-outline'];
  const iconsFilled: IconName[] = ['home', 'grid', 'bag', 'person'];
  const labels = ['홈', '레시피', '쇼핑', '프로필'];

  return (
    <View style={styles.tabBarWrapper}>
      {/* 탭바 본체 */}
      <View style={[styles.tabBar, Platform.OS === 'android' && { paddingBottom: Math.max(insets.bottom, 20), height: 64 + Math.max(insets.bottom, 20) }]}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;

          const onPress = () => {
            try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <View key={route.key} style={styles.tabItem}>
              <TouchableOpacity
                style={styles.tabButton}
                onPress={onPress}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={focused ? iconsFilled[index] : icons[index]}
                  size={24}
                  color="#1A1A1A"
                />
                <Text style={[
                  styles.tabLabel,
                  focused && styles.tabLabelActive,
                ]}>
                  {labels[index]}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      // detachInactiveScreens 기본값 사용 (true) — 화면 밖 탭은 메모리에서 분리 가능
      screenOptions={{
        headerShown: false,
        // 탭 전환 애니메이션 없음 — 즉시 표시(fade 120ms 누적이 반복 전환에서 렉 체감 큼)
        animation: 'none',
        // 블러 시 화면 freeze — 활성 탭이 아닐 때 setState/re-render 차단해 메인 스레드 부담 ↓
        freezeOnBlur: true,
        // 탭이 처음 방문될 때만 마운트 — 콜드 스타트 시간 단축
        lazy: true,
        sceneStyle: { backgroundColor: '#FFFFFF' },
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="recipe" />
      <Tabs.Screen name="shop" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBarWrapper: {
    position: 'relative',
    backgroundColor: 'transparent',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    height: 70,
    alignItems: 'center',
    justifyContent: 'space-around',
    borderTopWidth: 0.5,
    borderTopColor: '#E8E8E8',
    paddingBottom: Platform.OS === 'ios' ? 20 : 0,
    ...Platform.select({
      ios: { height: 86 },
      android: { height: 64 },
    }),
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    minWidth: 56,
    minHeight: 56,
  },
  tabIcon: {
    fontSize: 34,
    color: '#BDBDBD',
  },
  tabIconActive: {
    color: '#1A1A1A',
  },
  tabIconHome: {
    fontSize: 36,
    marginTop: -5,
    transform: [{ scaleX: 1.2 }],
  },
  tabIconSearch: {
    fontSize: 45,
    marginTop: -12,
    marginBottom: -8,
  },
  tabLabel: {
    fontSize: 10,
    color: '#1A1A1A',
    marginTop: 2,
  },
  tabLabelActive: {
    color: '#1A1A1A',
    fontWeight: '700',
  },
});

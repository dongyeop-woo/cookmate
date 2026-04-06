import { Tabs } from 'expo-router';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const icons = ['⌂', '⌕', '⊞', '⊙'];
  const iconsFilled = ['⌂', '⌕', '⊞', '⊙'];
  const labels = ['홈', '검색', '레시피', '프로필'];

  return (
    <View style={styles.tabBarWrapper}>
      {/* 탭바 본체 */}
      <View style={styles.tabBar}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;

          const onPress = () => {
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
                <Text style={[
                  styles.tabIcon,
                  focused && styles.tabIconActive,
                  index === 0 && styles.tabIconHome,
                  index === 1 && styles.tabIconSearch,
                ]}>
                  {focused ? iconsFilled[index] : icons[index]}
                </Text>
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
      screenOptions={{
        headerShown: false,
        animation: 'fade',
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="search" />
      <Tabs.Screen name="recipe" />
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
    paddingBottom: Platform.OS === 'ios' ? 20 : 4,
    ...Platform.select({
      ios: { height: 86 },
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
    color: '#BDBDBD',
    marginTop: 2,
  },
  tabLabelActive: {
    color: '#1A1A1A',
  },
});

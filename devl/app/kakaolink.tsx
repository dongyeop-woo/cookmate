import { useEffect } from 'react';
import { View, ActivityIndicator, InteractionManager } from 'react-native';
import { useLocalSearchParams, useRootNavigationState, router } from 'expo-router';

export default function KakaoLink() {
  const params = useLocalSearchParams<{ type?: string; uid?: string; id?: string }>();
  const rootState = useRootNavigationState();

  useEffect(() => {
    if (!rootState?.key) return;
    const task = InteractionManager.runAfterInteractions(() => {
      const { type, uid, id } = params;
      if (type === 'profile' && uid) {
        router.replace(`/profile/${uid}`);
      } else if (type === 'recipe' && id) {
        router.replace(`/recipe/${id}`);
      } else {
        router.replace('/');
      }
    });
    return () => task.cancel();
  }, [rootState?.key, params.type, params.uid, params.id]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
      <ActivityIndicator size="large" color="#0B9A61" />
    </View>
  );
}

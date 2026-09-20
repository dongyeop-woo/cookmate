import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PUSH_ENABLED_KEY = '@push_enabled';

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    // 쿠킹 타이머 종료 ping은 TTS가 별도로 안내 — 배너/리스트 숨기고 소리만.
    const data = notification.request.content.data as { type?: string } | undefined;
    if (data?.type === 'cookingTimerPing') {
      return {
        shouldShowAlert: false,
        shouldShowBanner: false,
        shouldShowList: false,
        shouldPlaySound: true,
        shouldSetBadge: false,
      };
    }
    // 그 외 모든 알림은 앱이 켜져있어도 배너 표시.
    return {
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    };
  },
});

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default-v2', {
      name: '기본 알림',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      sound: 'default',
      lightColor: '#1A1A1A',
      enableVibrate: true,
      enableLights: true,
      showBadge: true,
    });
  }

  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId: '1e73a06b-3fc3-410c-846c-3ea3d422957c',
  });

  return tokenData.data;
}

export async function getPushEnabled(): Promise<boolean> {
  const value = await AsyncStorage.getItem(PUSH_ENABLED_KEY);
  return value !== 'false'; // default true
}

export async function setPushEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(PUSH_ENABLED_KEY, String(enabled));
}

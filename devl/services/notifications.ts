import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PUSH_ENABLED_KEY = '@push_enabled';
/** 사전 동의 시트를 마지막으로 띄운 날짜(YYYY-MM-DD). 하루 한 번만 묻는다. */
const OPTIN_ASKED_KEY = '@push_optin_asked_at';
/** "나중에" 를 누른 횟수. 두 번 거절하면 더는 묻지 않는다. */
const OPTIN_DECLINED_KEY = '@push_optin_declined';

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

/**
 * 시스템 다이얼로그를 띄우지 않고 현재 권한 상태만 읽는다.
 *
 * 'undetermined' 는 아직 한 번도 안 물어본 상태 — 사전 동의 시트를 띄울
 * 수 있는 유일한 기회다. iOS 는 시스템 창에서 한 번 거부당하면 앱에서
 * 다시 물을 수 없고 설정 앱으로 보내는 수밖에 없다.
 */
export async function getPushPermissionState(): Promise<
  'granted' | 'denied' | 'undetermined'
> {
  if (!Device.isDevice) return 'denied';
  const { status } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return 'granted';
  if (status === 'undetermined') return 'undetermined';
  return 'denied';
}

/**
 * 푸시 토큰을 발급받는다.
 *
 * prompt=false 면 이미 허용된 경우에만 동작하고 시스템 창을 띄우지 않는다.
 * 앱 시작 시에는 반드시 false 로 부른다 — 사용자가 앱이 뭘 하는지도 모르는
 * 시점에 권한을 묻는 게 거부율이 가장 높고, iOS 는 그 한 번으로 끝이다.
 */
export async function registerForPushNotifications(
  { prompt = true }: { prompt?: boolean } = {},
): Promise<string | null> {
  if (!Device.isDevice) {
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    if (!prompt) return null;
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

/**
 * 지금 사전 동의 시트를 띄워도 되는지.
 *
 * 아직 한 번도 시스템 창을 안 띄운 상태여야 하고(그래야 기회가 남아 있다),
 * 오늘 이미 물어봤거나 두 번 거절당했으면 띄우지 않는다.
 */
export async function shouldAskPushOptIn(): Promise<boolean> {
  if ((await getPushPermissionState()) !== 'undetermined') return false;
  const [askedAt, declined] = await Promise.all([
    AsyncStorage.getItem(OPTIN_ASKED_KEY),
    AsyncStorage.getItem(OPTIN_DECLINED_KEY),
  ]);
  if (Number(declined ?? 0) >= 2) return false;
  return askedAt !== new Date().toISOString().slice(0, 10);
}

/** 시트를 띄운 날짜를 기록한다. 같은 날 여러 번 묻지 않기 위해. */
export async function markPushOptInAsked(): Promise<void> {
  await AsyncStorage.setItem(OPTIN_ASKED_KEY, new Date().toISOString().slice(0, 10));
}

/** "나중에" 를 눌렀을 때. 두 번 쌓이면 더는 묻지 않는다. */
export async function markPushOptInDeclined(): Promise<void> {
  const n = Number((await AsyncStorage.getItem(OPTIN_DECLINED_KEY)) ?? 0);
  await AsyncStorage.setItem(OPTIN_DECLINED_KEY, String(n + 1));
}

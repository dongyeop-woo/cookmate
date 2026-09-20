// expo prebuild 시 AndroidManifest.xml에 Foreground Service 권한 + 서비스 선언을 자동 주입.
// 직접 manifest를 편집하면 prebuild로 덮어써져 사라지므로 plugin 형태로 관리.

const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins');

const SERVICE_NAME = 'expo.modules.cookingliveactivity.CookingTimerService';

const withCookingTimerService = (config) => {
  // 권한 추가 — FOREGROUND_SERVICE + FOREGROUND_SERVICE_SPECIAL_USE
  config = AndroidConfig.Permissions.withPermissions(config, [
    'android.permission.FOREGROUND_SERVICE',
    'android.permission.FOREGROUND_SERVICE_SPECIAL_USE',
  ]);

  // <application> 안에 <service> 선언 추가
  return withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest.application?.[0];
    if (!app) return cfg;
    if (!app.service) app.service = [];

    const exists = app.service.some(
      (s) => s.$ && s.$['android:name'] === SERVICE_NAME
    );
    if (!exists) {
      app.service.push({
        $: {
          'android:name': SERVICE_NAME,
          'android:exported': 'false',
          'android:foregroundServiceType': 'specialUse',
          'android:stopWithTask': 'false',
        },
        property: [
          {
            $: {
              'android:name': 'android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE',
              'android:value': 'cooking_timer_for_step_progress',
            },
          },
        ],
      });
    }
    return cfg;
  });
};

module.exports = withCookingTimerService;

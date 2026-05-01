const { withAndroidManifest } = require('expo/config-plugins');

/**
 * MainActivity에 android:configChanges를 주입해서 config 변경 시
 * Activity가 재생성되지 않도록 한다.
 * - 태블릿의 멀티윈도우/방향/UI모드 전환 시 재생성돼 expo-image-picker의
 *   ActivityResultLauncher가 등록 해제되는 이슈 방지.
 */
const CONFIG_CHANGES = [
  'orientation',
  'screenSize',
  'screenLayout',
  'smallestScreenSize',
  'keyboardHidden',
  'keyboard',
  'uiMode',
  'density',
  'layoutDirection',
  'locale',
  'fontScale',
].join('|');

module.exports = function withActivityConfigChanges(config) {
  return withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest.application?.[0];
    if (!app || !app.activity) return cfg;

    for (const activity of app.activity) {
      const name = activity.$?.['android:name'];
      if (name === '.MainActivity') {
        activity.$['android:configChanges'] = CONFIG_CHANGES;
      }
    }
    return cfg;
  });
};

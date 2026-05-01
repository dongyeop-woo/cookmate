const { withMainActivity } = require('expo/config-plugins');

module.exports = function withFixedDensity(config) {
  return withMainActivity(config, (config) => {
    let contents = config.modResults.contents;

    // import 추가
    if (!contents.includes('import android.content.res.Configuration')) {
      contents = contents.replace(
        'import expo.modules.ReactActivityDelegateWrapper',
        'import android.content.res.Configuration\nimport expo.modules.ReactActivityDelegateWrapper'
      );
    }

    // attachBaseContext override - 기기 물리 밀도로 강제 고정 (화면 크기 "보통")
    if (!contents.includes('attachBaseContext')) {
      const insertPoint = contents.lastIndexOf('}');
      const patch = `
  override fun attachBaseContext(newBase: android.content.Context?) {
    val override = newBase?.let {
      val config = Configuration(it.resources.configuration)
      config.fontScale = 1.0f
      // 기기의 물리적 기본 밀도 사용 (사용자 설정 무시)
      config.densityDpi = android.content.res.Resources.getSystem().displayMetrics.densityDpi
      it.createConfigurationContext(config)
    }
    super.attachBaseContext(override ?: newBase)
  }
`;
      contents = contents.substring(0, insertPoint) + patch + contents.substring(insertPoint);
    }

    config.modResults.contents = contents;
    return config;
  });
};

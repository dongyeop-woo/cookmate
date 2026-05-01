const { withDangerousMod, withProjectBuildGradle } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const KAKAO_REPO = "maven { url 'https://devrepo.kakao.com/nexus/content/groups/public/' }";

module.exports = function withKakaoSDKVersion(config) {
  // iOS: Podfile에 KakaoSDKVersion 변수 추가
  config = withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(
        config.modRequest.platformProjectRoot,
        'Podfile'
      );
      let contents = fs.readFileSync(podfilePath, 'utf-8');
      if (!contents.includes('$KakaoSDKVersion')) {
        contents = `$KakaoSDKVersion = '2.22.0'\n` + contents;
      }
      fs.writeFileSync(podfilePath, contents);
      return config;
    },
  ]);

  // Android: 카카오 Maven repo 추가
  config = withProjectBuildGradle(config, (config) => {
    if (!config.modResults.contents.includes('devrepo.kakao.com')) {
      config.modResults.contents = config.modResults.contents.replace(
        /maven \{ url 'https:\/\/www\.jitpack\.io' \}/,
        `maven { url 'https://www.jitpack.io' }\n    ${KAKAO_REPO}`
      );
    }
    return config;
  });

  return config;
};

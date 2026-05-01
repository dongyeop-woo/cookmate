/** @type {import('@bacons/apple-targets/app.plugin').Config} */
module.exports = {
  type: 'widget',
  name: 'CookmateLiveActivity',
  displayName: '요잘알 타이머',
  // iOS 16.1+ 필요 (Live Activities 도입)
  deploymentTarget: '16.1',
  frameworks: ['SwiftUI', 'WidgetKit', 'ActivityKit'],
  // 위젯 타겟에 포함할 이미지 — Image("yojalalLogo")로 SwiftUI에서 참조
  // ⚠️ 위젯 메모리 한계로 작은 사이즈(256px) 필수 — 원본(4096px)은 placeholder로 폴백됨
  images: {
    yojalalLogo: '../../assets/logo-widget.png',
  },
};

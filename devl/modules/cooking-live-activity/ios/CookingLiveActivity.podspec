Pod::Spec.new do |s|
  s.name           = 'CookingLiveActivity'
  s.version        = '0.0.1'
  s.summary        = 'iOS Live Activity bridge for cooking timer'
  s.description    = 'Bridges ActivityKit start/update/end to React Native via Expo Modules.'
  s.author         = ''
  s.homepage       = 'https://yojalal.app'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = '**/*.{h,m,swift}'
end

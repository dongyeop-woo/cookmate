const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

module.exports = function withFirebaseFix(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(
        config.modRequest.platformProjectRoot,
        'Podfile'
      );
      let contents = fs.readFileSync(podfilePath, 'utf-8');

      // Fix "non-modular header inside framework module" errors for
      // RNFBApp / RNFBAuth when using useFrameworks: "static".
      // We allow non-modular includes for those specific pods.
      const patch = `
  # [withFirebaseFix] Allow non-modular includes for Firebase bridge pods
  post_install do |installer|
    installer.pods_project.targets.each do |target|
      if ['RNFBApp', 'RNFBAuth'].include?(target.name)
        target.build_configurations.each do |config|
          config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
        end
      end
    end
  end`;

      if (!contents.includes('CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES')) {
        // Insert before the final 'end' of the target block
        // Find the post_install block if it already exists, or add before the last end
        if (contents.includes('post_install do |installer|')) {
          // Append our logic into the existing post_install block
          contents = contents.replace(
            /post_install do \|installer\|/,
            `post_install do |installer|
    # [withFirebaseFix] Allow non-modular includes for Firebase bridge pods
    installer.pods_project.targets.each do |target|
      if ['RNFBApp', 'RNFBAuth'].include?(target.name)
        target.build_configurations.each do |config|
          config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
        end
      end
    end`
          );
        } else {
          // No post_install exists, add one before the last 'end'
          const lastEndIndex = contents.lastIndexOf('end');
          contents =
            contents.substring(0, lastEndIndex) +
            patch +
            '\n' +
            contents.substring(lastEndIndex);
        }
      }

      fs.writeFileSync(podfilePath, contents);
      return config;
    },
  ]);
};

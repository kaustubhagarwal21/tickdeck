// Metro bundler config: Expo's defaults, plus access to the shared package.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// @tickdeck/core is plain TypeScript in ../packages/core, outside this app.
const coreDir = path.resolve(__dirname, '../packages/core');
const coreEntry = path.join(coreDir, 'src/index.ts');

// Metro only bundles files inside the folders it watches, so watch the package too.
config.watchFolders = [...(config.watchFolders ?? []), coreDir];

// Resolve the bare import '@tickdeck/core' to the package's entry file, the
// same file tsconfig.json "paths" points TypeScript at. Every other import
// goes through Metro's normal resolution.
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === '@tickdeck/core') {
    return { type: 'sourceFile', filePath: coreEntry };
  }
  return defaultResolveRequest
    ? defaultResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;

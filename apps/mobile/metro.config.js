// The app reuses the live Builder's planning logic from the site's lib/ folder
// (lib/dated-plan.ts, lib/plan-progress.ts, lib/plan-ics.ts) through the @core/* path in
// tsconfig.json, so Metro must be allowed to read files two folders up.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const siteLib = path.resolve(__dirname, '../../lib');
config.watchFolders = [...(config.watchFolders ?? []), siteLib];
config.resolver.nodeModulesPaths = [path.resolve(__dirname, 'node_modules')];
module.exports = config;

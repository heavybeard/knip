import path from 'node:path';
import { _load } from '../../util/loader.js';
import { getPackageName } from '../../util/modules.js';
import { isAbsolute } from '../../util/path.js';
import { timerify } from '../../util/performance.js';
import { hasDependency } from '../../util/plugin.js';
import { _resolve } from '../../util/require.js';
import type { IsPluginEnabledCallback, GenericPluginCallback } from '../../types/plugins.js';
import type { Config } from '@jest/types';

// https://jestjs.io/docs/configuration

export const NAME = 'Jest';

/** @public */
export const ENABLERS = ['jest'];

export const isEnabled: IsPluginEnabledCallback = ({ dependencies }) => hasDependency(dependencies, ENABLERS);

export const CONFIG_FILE_PATTERNS = ['jest.config.{js,ts,mjs,cjs,json}'];

export const ENTRY_FILE_PATTERNS = ['**/__tests__/**/*.[jt]s?(x)', '**/?(*.)+(spec|test).[jt]s?(x)'];

const join = (base: string, id: string) => (isAbsolute(id) ? id : path.join(path.dirname(base), id));

const resolveExtensibleConfig = async (configFilePath: string) => {
  const config: Config.InitialOptions = await _load(configFilePath);
  if (config?.preset) {
    const { preset } = config;
    if (preset.startsWith('.') || isAbsolute(preset)) {
      const presetConfigPath = join(configFilePath, preset);
      const presetConfig = await resolveExtensibleConfig(presetConfigPath);
      delete config.preset;
      Object.assign(config, presetConfig);
    }
  }
  return config;
};

const findJestDependencies: GenericPluginCallback = async (configFilePath, { cwd }) => {
  const config: Config.InitialOptions = await resolveExtensibleConfig(configFilePath);

  if (!config) return [];

  const dependencies: string[] = [];
  const entryFiles: string[] = [];

  const handleEntries = (name: string) => {
    name = name.includes('<rootDir>') ? path.join(cwd, name.replace(/^.*<rootDir>/, '')) : name;
    if (name.startsWith('.') || isAbsolute(name)) {
      entryFiles.push(_resolve(join(configFilePath, name)));
    } else {
      dependencies.push(name);
    }
  };

  if (config.setupFiles) config.setupFiles.forEach(handleEntries);
  if (config.setupFilesAfterEnv) config.setupFilesAfterEnv.forEach(handleEntries);
  if (config.transform) {
    Object.values(config.transform)
      .map(transform => (typeof transform === 'string' ? transform : transform[0]))
      .forEach(handleEntries);
  }

  const presets = config.preset ? [config.preset] : [];
  const environments = config.testEnvironment === 'jsdom' ? ['jest-environment-jsdom'] : [];
  const resolvers = config.resolver ? [config.resolver] : [];
  const watchPlugins =
    config.watchPlugins?.map(watchPlugin => (typeof watchPlugin === 'string' ? watchPlugin : watchPlugin[0])) ?? [];

  return {
    dependencies: [...presets, ...environments, ...dependencies, ...resolvers, ...watchPlugins].map(getPackageName),
    entryFiles,
  };
};

export const findDependencies = timerify(findJestDependencies);

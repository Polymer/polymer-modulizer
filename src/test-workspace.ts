/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */

import chalk from 'chalk';
import * as path from 'path';
import {run, WorkspaceRepo} from 'polymer-workspaces';

import {WorkspaceConversionSettings} from './convert-workspace';
import {generatePackageJson, localDependenciesBranch, readJson, writeJson} from './manifest-converter';
import {lookupNpmPackageName} from './urls/workspace-url-handler';
import {exec, logRepoError, logStep} from './util';

/**
 * Configuration options required for workspace testing. Same as conversion
 * settings.
 */
interface WorkspaceTestSettings extends WorkspaceConversionSettings {}

/**
 * Setup the workspace repos for testing. Be sure to call restoreRepos() after
 * testing is complete.
 */
async function setupRepos(
    reposUnderTest: WorkspaceRepo[],
    localConversionMap: Map<string, string>,
    options: WorkspaceTestSettings) {
  // Yarn sometimes has some issues with bad packages entering the cache from
  // modulizer. Clear the cache before starting.
  const {stderr} = await exec(options.workspaceDir, 'yarn', ['cache', 'clean']);
  if (stderr.length > 0) {
    console.log(chalk.dim(`yarn cache clean: ${stderr}`));
  }

  const batchResults = await run(reposUnderTest, async (repo) => {
    await exec(repo.dir, 'git', ['checkout', '-B', localDependenciesBranch]);
    writeTestingPackageJson(repo, localConversionMap, options.packageVersion);
    await exec(
        repo.dir,
        'git',
        ['commit', '-a', '-m', 'testing commit', '--allow-empty']);
  }, {concurrency: 10});
  batchResults.failures.forEach(logRepoError);

  return [...batchResults.successes.keys()];
}

/**
 * Run `yarn install` to install dependencies in a repo. Note that this creates
 * a node_modules/ folder & an associated yarn.lock file as side effects.
 */
async function installDependencies(reposUnderTest: WorkspaceRepo[]) {
  const batchResults = await run(reposUnderTest, async (repo) => {
    const repoDirName = path.basename(repo.dir);
    const {stderr} = await exec(repo.dir, 'npm', ['install']);
    if (stderr.length > 0) {
      console.log(chalk.dim(`${repoDirName}: ${stderr}`));
    }
  }, {concurrency: 1});

  batchResults.failures.forEach(logRepoError);
  return [...batchResults.successes.keys()];
}

/**
 * Run `wct --npm` in a repo.
 */
async function testRepos(reposUnderTest: WorkspaceRepo[]) {
  const batchResults = await run(reposUnderTest, async (repo) => {
    const repoDirName = path.basename(repo.dir);
    const {stdout, stderr} = await exec(repo.dir, 'wct', ['--npm']);
    console.log(stdout, stderr);
    if (stdout.length > 0) {
      console.log(chalk.dim(`${repoDirName}: ${stdout}`));
    }
    if (stderr.length > 0) {
      console.log(chalk.red(`${repoDirName}: ${stderr}`));
    }
  }, {concurrency: 1});

  batchResults.failures.forEach(logRepoError);
  return [...batchResults.successes.keys()];
}

/**
 * Restore the repos to their proper state.
 */
async function restoreRepos(reposUnderTest: WorkspaceRepo[]) {
  const batchResults = await run(reposUnderTest, async (repo) => {
    await repo.git.destroyAllUncommittedChangesAndFiles();
    await repo.git.checkout('polymer-modulizer-staging');
  }, {concurrency: 10});

  batchResults.failures.forEach(logRepoError);
  return [...batchResults.successes.keys()];
}

/**
 * For a given repo, generate a new package.json and write it to disk.
 */
function writeTestingPackageJson(
    repo: WorkspaceRepo,
    localConversionMap: Map<string, string>,
    newPackageVersion: string) {
  const bowerPackageName = path.basename(repo.dir);
  const bowerJsonPath = path.join(repo.dir, 'bower.json');
  const bowerJson = readJson(bowerJsonPath);
  const npmPackageName =
      lookupNpmPackageName(bowerJsonPath) || bowerPackageName;
  const packageJson = generatePackageJson(
      bowerJson, npmPackageName, newPackageVersion, localConversionMap);
  writeJson(packageJson, repo.dir, 'package.json');
}

export async function testWorkspace(
    localConversionMap: Map<string, string>, options: WorkspaceTestSettings) {
  const allRepos = options.reposToConvert;

  logStep('[1/5]', '🔧', `Preparing Repos...`);
  const setupSuccesses =
      await setupRepos(allRepos, localConversionMap, options);

  logStep('[2/5]', '🔧', `Installing Dependencies...`);
  const installSuccesses = await installDependencies(setupSuccesses);

  logStep('[3/5]', '🔧', `Running Tests...`);
  const testResults = await testRepos(installSuccesses);

  logStep('[4/5]', '🔧', `Restoring Repos...`);
  await restoreRepos(allRepos);

  logStep('[5/5]', '🔧', `Tests Complete!`);
  return testResults;
}

export async function testWorkspaceInstallOnly(
    localConversionMap: Map<string, string>, options: WorkspaceTestSettings) {
  const allRepos = options.reposToConvert;

  logStep('[1/4]', '🔧', `Preparing Repos...`);
  const setupSuccesses =
      await setupRepos(allRepos, localConversionMap, options);

  logStep('[2/4]', '🔧', `Installing Dependencies...`);
  const installResults = await installDependencies(setupSuccesses);

  logStep('[3/4]', '🔧', `Restoring Repos...`);
  await restoreRepos(allRepos);

  logStep('[4/4]', '🔧', `Tests Complete!`);
  return installResults;
}

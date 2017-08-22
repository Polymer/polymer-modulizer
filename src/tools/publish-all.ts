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

import * as commandLineArgs from 'command-line-args';
import * as cp from 'mz/child_process';
import * as fs from 'mz/fs';
import * as path from 'path';

const optionDefinitions: commandLineArgs.OptionDefinition[] = [
  {
    name: 'expected-version',
    type: String,
    description: `The version that we intend to publish. ` +
        `We'll only publish packages with this version in their package.json`,
  },
  {
    name: 'production',
    type: Boolean,
    defaultValue: false,
    description:
        `If given, publish to the real 'npm' instance, not our local one.`
  },
  {
    name: 'command',
    description:
        `Either 'push' or 'publish'. If 'push', we commit the changes and push them up to git. If 'publish', we publish up to npm.`
  }

];

interface Options {
  readonly 'expected-version': string|undefined;
  readonly production: boolean;
  readonly command: 'push'|'publish';
}

async function run(
    command: string, options: cp.ExecOptions&{cwd: string}): Promise<string> {
  const [stdoutBuf, stderrBuf] = await cp.exec(command, options);
  return stdoutBuf.toString('utf8').trim() + stderrBuf.toString('utf8').trim();
}

async function main() {
  const options: Options = commandLineArgs(optionDefinitions) as any;
  let expectedUser;
  if (options.production) {
    expectedUser = 'polymer';
  } else {
    expectedUser = 'fake';
    process.env.npm_config_registry = 'http://35.199.169.12';
  }
  if (await run('npm whoami', {cwd: '.'}) !== expectedUser) {
    throw new Error(`Not running as the npm user '${expectedUser}'`);
  }
  const expectedVersion = options['expected-version'];
  if (!expectedVersion) {
    throw new Error(`No expected version given.`);
  }
  const workspacePath = './modulizer_workspace';
  const dirs = await fs.readdir(workspacePath);
  for (const dir of dirs) {
    if (dir === 'polymer') {
      // Temporary skip because we hand-edit polymer core's readme, and
      // fixup its shadycss import paths.
      continue;
    }
    const fullPath = path.resolve(path.join(workspacePath, dir));
    const packagePath = path.join(fullPath, 'package.json');
    if (!(await fs.exists(packagePath)) ||
        !(await fs.exists(path.join(fullPath, '.git')))) {
      continue;
    }
    const pckage = JSON.parse(await fs.readFile(packagePath, 'utf8'));
    if (!pckage.name.startsWith('@polymer')) {
      continue;
    }
    if (pckage.version !== expectedVersion) {
      continue;
    }

    if (options.command === 'push') {
      const branchName =
          await run('git rev-parse --abbrev-ref HEAD', {cwd: fullPath});
      if (branchName === 'master') {
        const sha = await run('git rev-parse HEAD', {cwd: fullPath});
        await run('git checkout -b 3.0-preview', {cwd: fullPath});
        await run('git add ./', {cwd: fullPath});
        await run(
            `git commit -m "Automatic polymer-modulizer conversion of ${sha}"`,
            {cwd: fullPath});
        if (options.production) {
          // await run(`git push origin 3.0-preview`, {cwd: fullPath});
          console.log(`+ ${dir} pushed`);
        } else {
          console.log(`- ${dir} was not pushed`);
        }
      } else {
        console.log(`x ${dir} wasn't at master, it was on ${branchName}`);
      }
    } else if (options.command === 'publish') {
      const foundVersion: string = await run(
          `npm show ${pckage.name}@${expectedVersion} version`, {cwd: '.'});
      if (foundVersion === expectedVersion) {
        console.log(`~ ${pckage.name} already published as ${expectedVersion}`);
        continue;
      } else {
        console.log(await run('npm publish --tag next', {cwd: fullPath}));
      }
    } else {
      const never: never = options.command;
      throw new Error(`Invalid --command given: ${never}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

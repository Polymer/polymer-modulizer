#!/usr/bin/env node

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

import * as path from 'path';
import * as cp from 'mz/child_process';
import * as fs from 'mz/fs';
import * as commandLineArgs from 'command-line-args';

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
  }
];

interface Options {
  readonly 'expected-version': string|undefined;
  readonly production: boolean;
}

async function run(
    command: string, options: cp.ExecOptions = {}): Promise<string> {
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
  if (await run('npm whoami') !== expectedUser) {
    throw new Error(`Not running as the npm user '${expectedUser}'`);
  }
  const expectedVersion = options['expected-version'];
  if (!expectedVersion) {
    throw new Error(`No expected version given.`);
  }
  const workspacePath = './modulizer_workspace';
  const dirs = await fs.readdir(workspacePath);
  for (const dir of dirs) {
    const fullPath = path.join(workspacePath, dir);
    const packagePath = path.join(fullPath, 'package.json');
    if (!(await fs.exists(packagePath))) {
      continue;
    }
    const pckage = JSON.parse(await fs.readFile(packagePath, 'utf8'));
    if (!pckage.name.startsWith('@polymer')) {
      continue;
    }
    if (pckage.version !== expectedVersion) {
      continue;
    }
    const foundVersion: string =
        await run(`npm show ${pckage.name}@${expectedVersion} version`);
    if (foundVersion === expectedVersion) {
      console.log(`~ ${pckage.name} already published as ${expectedVersion}`);
      continue;
    } else {
      console.log(
          await run('npm publish --tag next', {cwd: path.resolve(fullPath)}));
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

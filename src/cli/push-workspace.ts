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

import * as chalk from 'chalk';
import * as inquirer from 'inquirer';
import {Workspace, WorkspaceRepo} from 'polymer-workspaces';

export default async function run(workspace: Workspace, reposToConvert: WorkspaceRepo[]) {
  const {commitMessage, branchName, forcePush} = (await inquirer.prompt([
    {
      type: 'input',
      name: 'branchName',
      message: 'push to branch:',
    },
    {
      type: 'confirm',
      name: 'forcePush',
      message: 'force push? (WARNING: This will overwrite any existing branch on github)',
      default: false,
    },
    {
      type: 'input',
      name: 'commitMessage',
      message: 'with commit message:',
      default: '"auto-generated with polymer-modulizer"',
    }
  ]));

  console.log(
      chalk.dim('[1/4]') + ' 🌀  ' +
      chalk.magenta(`Preparing new branches...`));
  await workspace.startNewBranch(reposToConvert, 'polymer-modulizer-staging');

  console.log(
      chalk.dim('[2/4]') + ' 🌀  ' + chalk.magenta(`Committing changes...`));
  await workspace.commitChanges(reposToConvert, commitMessage);

  console.log('');
  console.log('Ready to publish:');
  for (const repo of reposToConvert) {
    console.log(`  - ${repo.github.fullName}  ${chalk.dim(repo.github.ref || repo.github.defaultBranch)} -> ${chalk.green(branchName)}`);
  }
  console.log('');

  const {confirmPublish} = (await inquirer.prompt([{
    type: 'confirm',
    name: 'confirmPublish',
    message: 'start?',
    default: true,
  }]));

  if (!confirmPublish) {
    return;
  }

  console.log(
      chalk.dim('[3/4]') + ' 🌀  ' + chalk.magenta(`Pushing to GitHub...`));
  await workspace.pushChangesToGithub(reposToConvert, branchName, forcePush);

  console.log(chalk.dim('[4/4]') + ' 🎉  ' + chalk.magenta(`Push Complete!`));
}

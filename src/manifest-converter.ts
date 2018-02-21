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

'use strict';

import * as fs from 'mz/fs';
import {EOL} from 'os';
import * as path from 'path';
import * as spdxLicenseList from 'spdx-license-list/simple';
import {replaceHtmlExtensionIfFound} from './urls/util';

interface DependencyMapEntry {
  npm: string;
  semver: string;
}
interface DependencyMap {
  [bower: string]: DependencyMapEntry|undefined;
}
const dependencyMap: DependencyMap =
    readJson(__dirname, '../dependency-map.json');
const warningCache: Set<String> = new Set();

/**
 * The name of the git branch for local git dependencies to point to. Without
 * a branch name, npm would just install from master.
 */
export const localDependenciesBranch = 'polymer-modulizer-testing';

/**
 * For a given dependency at path, return the value that will point to it in a
 * package.json "dependencies" or "devDependencies" object.
 */
function getLocalDependencyValue(path: string) {
  return `git+file:${path}#${localDependenciesBranch}`;
}

/**
 * Lookup the corresponding npm package name in our local map. By default, this
 * method will log a standard warning message to the user if no mapping was
 * found.
 */
export function lookupDependencyMapping(bowerPackageName: string) {
  const result = dependencyMap[bowerPackageName];
  if (!result && !warningCache.has(bowerPackageName)) {
    warningCache.add(bowerPackageName);
    console.warn(
        `WARN: bower->npm mapping for "${bowerPackageName}" not found`);
  }
  return result;
}

function setNpmDependencyFromBower(
    obj: any, bowerPackageName: string, useLocal?: Map<string, string>) {
  const depInfo = lookupDependencyMapping(bowerPackageName);
  if (!depInfo) {
    return;
  }
  if (useLocal && useLocal.has(depInfo.npm)) {
    obj[depInfo.npm] = getLocalDependencyValue(useLocal.get(depInfo.npm)!);
  } else {
    obj[depInfo.npm] = depInfo.semver;
  }
}

/**
 * helper function to read and parse JSON.
 */
export function readJson(...pathPieces: string[]) {
  const jsonPath = path.resolve(...pathPieces);
  const jsonContents = fs.readFileSync(jsonPath, 'utf-8');
  return JSON.parse(jsonContents);
}

/**
 * helper function to serialize and parse JSON.
 */
export function writeJson(json: any, ...pathPieces: string[]) {
  const jsonPath = path.resolve(...pathPieces);
  const jsonContents =
      JSON.stringify(json, undefined, 2).split('\n').join(EOL) + EOL;
  fs.writeFileSync(jsonPath, jsonContents);
}

/**
 * Generate the package.json for a modulized package from its bower.json,
 * optionally merging with an existing package.json.
 *
 * @param bowerJson The package's existing parsed bower.json.
 * @param name NPM package name. Always wins over existingPackageJson.
 * @param version NPM package version. Always wins over existingPackageJson.
 * @param useLocal Optional map of any NPM dependencies (name -> local file
 * path) that should be referenced via local file path and not public package
 * name in the package.json. This is useful for testing against other, converted
 * repos.
 * @param existingPackageJson Optional pre-existing parsed package.json. If
 * provided, values from this package.json will win over ones derived from
 * bower.json, with these exceptions:
 *   - name, version, flat, and private are always overridden.
 *   - dependencies, devDependencies, and resolutions are merged, with newly
 *     generated versions for the same package winning.
 */
export function generatePackageJson(
    bowerJson: Partial<BowerConfig>,
    name: string,
    version: string,
    useLocal?: Map<string, string>,
    existingPackageJson?: Partial<YarnConfig>): YarnConfig {
  const packageJson: YarnConfig = {
    description: bowerJson.description,
    keywords: bowerJson.keywords,
    repository: bowerJson.repository,
    homepage: bowerJson.homepage,

    ...existingPackageJson,

    name,
    version,
    flat: true,
    // TODO(aomarks) We probably want this behind a flag, because switching an
    // existing package to be publishable could be dangerous. We need this for
    // the Polymer elements, because the 2.x branches are marked private.
    private: undefined,
  };

  // TODO (fks): Remove these resolutions needed by wct-browser-legacy
  // https://github.com/Polymer/polymer-modulizer/issues/251
  packageJson.resolutions = {
    ...packageJson.resolutions,
    'inherits': '2.0.3',
    'samsam': '1.1.3',
    'supports-color': '3.1.2',
    'type-detect': '1.0.0',
  };

  if (!packageJson.main) {
    let main;
    if (typeof bowerJson.main === 'string') {
      main = bowerJson.main;
    } else if (Array.isArray(bowerJson.main)) {
      if (bowerJson.main.length === 1) {
        main = bowerJson.main[0];
      } else {
        // We could potentially be smarter here. Bower configs have loose
        // semantics around main, and allow one file per filetype. There might
        // be an HTML file for the main element, and some extra things like a
        // CSS file. Maybe in that case we should find just the HTML file.
        //
        // There could also be multiple HTML files in main, e.g. a repo like
        // paper-behaviors which contains 3 separate Polymer behaviors. We
        // currently let that be, so importing the module directly will fail.
        // We could also generate an index that re-exports all of the symbols
        // from all of the mains.
        console.warn(
            `${bowerJson.name}: Found multiple mains in bower.json, ` +
            `but package.json must have only one.`);
      }
    }
    if (main && main.endsWith('.html')) {
      // Assume that the bower main is already a correct relative path to an
      // HTML file, and that the module equivalent will be in the same directory
      // but with a JS extension.
      packageJson.main = replaceHtmlExtensionIfFound(main);
    } else {
      console.warn(
          `${bowerJson.name}: Could not automatically find main. ` +
          `Please manually set your package.json main.`);
    }
  }

  if (!packageJson.author &&
      (!packageJson.contributors || packageJson.contributors.length === 0)) {
    const npmAuthors = [];
    // Some Polymer elements use `author` even though the bower.json spec only
    // specifies `authors`. Check both.
    const bowerAuthors = bowerJson.authors || (bowerJson as any).author || [];
    for (const bowerAuthor of bowerAuthors) {
      if (typeof bowerAuthor === 'string') {
        npmAuthors.push(bowerAuthor);
      } else {
        npmAuthors.push({
          name: bowerAuthor.name,
          email: bowerAuthor.email,
          url: bowerAuthor.homepage,  // The only difference in the specs.
        });
      }
    }
    if (npmAuthors.length === 1) {
      packageJson.author = npmAuthors[0];
    } else if (npmAuthors.length > 1) {
      packageJson.contributors = npmAuthors;
    }
  }

  if (!packageJson.license) {
    let license;
    if (typeof bowerJson.license === 'string') {
      license = bowerJson.license;
    } else if (Array.isArray(bowerJson.license)) {
      if (bowerJson.license.length === 1) {
        license = bowerJson.license[0];
      } else {
        console.warn(
            `${bowerJson.name}: Found multiple licenses in bower.json, ` +
            `but package.json must have only one.`);
      }
    }
    if (license) {
      if (license.includes('polymer.github.io/LICENSE')) {
        license = 'BSD-3-Clause';
      } else if (!spdxLicenseList.has(license)) {
        console.warn(
            `${bowerJson.name}: ` +
            `'${bowerJson.license}' is not a valid SPDX license. ` +
            `You can find a list of valid licenses at ` +
            `https://spdx.org/licenses/`);
      }
      packageJson.license = license;
    } else {
      console.warn(
          `${bowerJson.name}: ` +
          `Could not automatically find appropriate license. ` +
          `Please manually set your package.json license according to ` +
          `https://docs.npmjs.com/files/package.json#license`);
    }
  }

  packageJson.dependencies = Object.assign({}, packageJson.dependencies);
  for (const bowerPackageName in bowerJson.dependencies || []) {
    setNpmDependencyFromBower(
        packageJson.dependencies, bowerPackageName, useLocal);
  }
  packageJson.devDependencies = Object.assign({}, packageJson.devDependencies);
  for (const bowerPackageName in bowerJson.devDependencies || []) {
    setNpmDependencyFromBower(
        packageJson.devDependencies, bowerPackageName, useLocal);
  }

  return packageJson;
}

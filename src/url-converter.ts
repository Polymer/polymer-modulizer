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

import {posix as path} from 'path';
import {dependencyMap} from './manifest-converter';

const htmlExtension = '.html';

/**
 * Given an HTML url relative to the project root, return true if that url
 * points to a bower dependency file.
 */
function isBowerDependencyUrl(htmlUrl: string) {
  return htmlUrl.startsWith('bower_components/') ||
      htmlUrl.startsWith('./bower_components/');
}

/**
 * Update a bower package name in a url (at path index) to its matching npm
 * package name.
 */
function convertBowerRootUrlToNpm(dependencyUrl: string): string {
  // Convert component folder name
  let jsUrl = dependencyUrl.replace('bower_components/', 'node_modules/');
  // Convert package name
  const jsUrlPieces = jsUrl.split('/');
  const bowerPackageName = jsUrlPieces[1];
  const mappingInfo = dependencyMap[bowerPackageName];
  if (mappingInfo) {
    jsUrlPieces[1] = mappingInfo.npm;
  } else {
    console.warn(
        `WARN: bower->npm mapping for "${bowerPackageName}" not found`);
  }
  jsUrl = jsUrlPieces.join('/');

  // Temporary workaround for urls that run outside of the current packages
  if (jsUrl.endsWith('shadycss/apply-shim.html')) {
    jsUrl = jsUrl.replace(
        'shadycss/apply-shim.html', 'shadycss/entrypoints/apply-shim.js');
  }
  if (jsUrl.endsWith('shadycss/custom-style-interface.html')) {
    jsUrl = jsUrl.replace(
        'shadycss/custom-style-interface.html',
        'shadycss/entrypoints/custom-style-interface.js');
  }

  return jsUrl;
}

/**
 * Converts an HTML Import path to a JS module path.
 */
export function convertRootUrl(htmlUrl: string): string {
  if (htmlUrl.startsWith('.') || htmlUrl.startsWith('/')) {
    throw new Error(
        `convertRootUrl() expects an unformatted document url from the analyzer, but got "${
                                                                                            htmlUrl
                                                                                          }"`);
  }
  let jsUrl = htmlUrl;
  // If url points to a bower_components dependency, update it to point to
  // its equivilent node_modules npm dependency.
  if (isBowerDependencyUrl(htmlUrl)) {
    jsUrl = convertBowerRootUrlToNpm(htmlUrl);
  }
  // Convert all HTML URLs to point to JS equivilent
  if (jsUrl.endsWith(htmlExtension)) {
    jsUrl = jsUrl.substring(0, jsUrl.length - htmlExtension.length) + '.js';
  }
  // TODO(fks): Revisit this format? The analyzer returns URLs without this
  return './' + jsUrl;
}


/**
 * Gets a relative URL from one JS module URL to another. Handles expected
 * formatting and relative/absolute urls.
 */
export function convertRelativeUrl(fromUrl: string, toUrl: string): string {
  // Error: Expects root URLs, relative to the project root
  if (!fromUrl.startsWith('./') || !toUrl.startsWith('./')) {
    throw new Error(
        `paths relative to root expected (actual: from="${fromUrl}", to="${
                                                                           toUrl
                                                                         }")`);
  }
  let moduleJsUrl = path.relative(path.dirname(fromUrl), toUrl);
  // Correct URL format to add './' preface if none exists
  // TODO(fks): Revisit this format?
  if (!moduleJsUrl.startsWith('.') && !moduleJsUrl.startsWith('/')) {
    moduleJsUrl = './' + moduleJsUrl;
  }
  return moduleJsUrl;
}

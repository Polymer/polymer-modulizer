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

/**
 * Update a bower package name in a url (at path index) to its matching npm
 * package name.
 */
function updatePackageNameInUrl(someUrl: string, index: number): string {
  const jsUrlPieces = someUrl.split('/');
  const bowerPackageName = jsUrlPieces[index];
  const mappingInfo = dependencyMap[bowerPackageName];
  if (mappingInfo) {
    jsUrlPieces[index] = mappingInfo.npm;
  } else {
    console.warn(
        `WARN: bower->npm mapping for "${bowerPackageName}" not found`);
  }
  return jsUrlPieces.join('/');
}

/**
 * Gets a relative URL from one JS module URL to another. Handles expected
 * formatting and relative/absolute urls.
 */
export function jsUrlRelative(fromUrl: string, toUrl: string): string {
  // Error: A from url should always be relative to root.
  if (fromUrl.startsWith('../')) {
    throw new Error(
        `paths relative to root expected (actual: from="${fromUrl}")`);
  }
  // do nothing to absolute urls.
  if (toUrl.startsWith('/')) {
    return toUrl;
  }
  // handle this mismatch here so that path.relative() works as expected.
  if (toUrl.startsWith('../') && fromUrl.startsWith('./node_modules/')) {
    toUrl = './node_modules/' + toUrl.slice('../'.length);
  }
  let moduleJsUrl = path.relative(path.dirname(fromUrl), toUrl);
  if (!moduleJsUrl.startsWith('.') && !moduleJsUrl.startsWith('/')) {
    moduleJsUrl = './' + moduleJsUrl;
  }
  return moduleJsUrl;
}

/**
 * Converts an HTML Import path to a JS module path.
 */
export function htmlUrlToJs(htmlUrl: string, from?: string): string {
  const htmlExtension = '.html';
  let jsUrl = htmlUrl;
  if (htmlUrl.endsWith(htmlExtension)) {
    jsUrl = htmlUrl.substring(0, htmlUrl.length - htmlExtension.length) + '.js';
  }

  // We've lost the actual URL string and thus the leading ./
  // This should be fixed in the Analyzer, and this hack isn't even right
  if (!jsUrl.startsWith('.') && !jsUrl.startsWith('/')) {
    jsUrl = './' + jsUrl;
  }

  // Fix any references to /bower_components/* & ./bower_components/*
  // to point to node_modules instead.
  if (jsUrl.startsWith('/bower_components/') ||
      jsUrl.startsWith('./bower_components/')) {
    jsUrl = jsUrl.replace('/bower_components/', '/node_modules/');
    jsUrl = updatePackageNameInUrl(jsUrl, 2);
  }
  // Convert bower import urls to npm import urls (package name change)
  if (jsUrl.startsWith('../')) {
    jsUrl = updatePackageNameInUrl(jsUrl, 1);
  }

  if (from !== undefined) {
    const fromJsUrl = htmlUrlToJs(from);
    jsUrl = jsUrlRelative(fromJsUrl, jsUrl);
  }

  // Temporary workaround for urls that run outside of the current packages
  // Also, TODO(rictic): point these at @webcomponentsjs/shadycss/...
  if (jsUrl.endsWith('shadycss/apply-shim.js')) {
    jsUrl = jsUrl.replace(
        'shadycss/apply-shim.js', 'shadycss/entrypoints/apply-shim.js');
  }
  if (jsUrl.endsWith('shadycss/custom-style-interface.js')) {
    jsUrl = jsUrl.replace(
        'shadycss/custom-style-interface.js',
        'shadycss/entrypoints/custom-style-interface.js');
  }

  return jsUrl;
}

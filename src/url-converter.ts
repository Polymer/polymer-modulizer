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
import * as url from 'url';
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
  // TODO: if current package / from has a scoped package name, url needs to
  // move an additional level up to get out of the current scoped dir.
  // jsUrlPieces.unshift('..');
  return jsUrlPieces.join('/');
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

  // Fix any references to /bower_components/* to point to node_modules instead
  if (jsUrl.startsWith('/bower_components/')) {
    jsUrl = '/node_modules/' + jsUrl.slice('/bower_components/'.length);
    jsUrl = updatePackageNameInUrl(jsUrl, 2);
  }
  // Fix any references to ./bower_components/* to point to node_modules instead
  if (jsUrl.startsWith('./bower_components/')) {
    jsUrl = './node_modules/' + jsUrl.slice('./bower_components/'.length);
    jsUrl = updatePackageNameInUrl(jsUrl, 2);
  }
  // Convert bower import urls to npm import urls (package name change)
  if (jsUrl.startsWith('../')) {
    jsUrl = updatePackageNameInUrl(jsUrl, 1);
  }

  if (from !== undefined) {
    const fromJsUrl = htmlUrlToJs(from);
    jsUrl = url.resolve(path.dirname(fromJsUrl), jsUrl);
    if (!jsUrl.startsWith('.') && !jsUrl.startsWith('/')) {
      jsUrl = './' + jsUrl;
    }
  }

  // Temporary workaround for urls that run outside of the current packages
  if (jsUrl.endsWith('shadycss/apply-shim.js')) {
    jsUrl =
        jsUrl.replace('shadycss/apply-shim.js', 'shadycss/apply-shim.min.js');
  }
  if (jsUrl.endsWith('shadycss/custom-style-interface.js')) {
    jsUrl = jsUrl.replace(
        'shadycss/custom-style-interface.js',
        'shadycss/custom-style-interface.min.js');
  }

  return jsUrl;
}

/**
 * Gets a relative URL from one JS module URL to another. Handles expected
 * formatting and scoping.
 */
export function jsUrlRelative(fromUrl: string, toUrl: string): string {
  let moduleJsUrl = url.resolve(path.dirname(fromUrl), toUrl);
  if (!moduleJsUrl.startsWith('.') && !moduleJsUrl.startsWith('/')) {
    moduleJsUrl = './' + moduleJsUrl;
  }
  return moduleJsUrl;
}

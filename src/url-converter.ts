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
 * Converts an HTML Import path to a JS module path.
 */
export function htmlUrlToJs(url: string, from?: string): string {
  const htmlExtension = '.html';
  let jsUrl = url;
  if (url.endsWith(htmlExtension)) {
    jsUrl = url.substring(0, url.length - htmlExtension.length) + '.js';
  }

  // We've lost the actual URL string and thus the leading ./
  // This should be fixed in the Analyzer, and this hack isn't even right
  if (!jsUrl.startsWith('.') && !jsUrl.startsWith('/')) {
    jsUrl = './' + jsUrl;
  }
  // Fix any references to /bower_components/* to point to siblings instead
  if (jsUrl.startsWith('/bower_components/')) {
    jsUrl = '../' + jsUrl.slice('/bower_components/'.length);
  }
  // Fix any references to ./bower_components/* to point to siblings instead
  if (jsUrl.startsWith('./bower_components/')) {
    jsUrl = '../' + jsUrl.slice('./bower_components/'.length);
  }
  // Convert bower import urls to npm import urls (package name change)
  if (jsUrl.startsWith('../')) {
    const jsUrlPieces = jsUrl.split('/');
    const mappingInfo = dependencyMap[jsUrlPieces[1]];
    if (mappingInfo) {
      jsUrlPieces[1] = mappingInfo.npm;
    } else {
      console.warn(
          `WARN: bower->npm mapping for "${jsUrlPieces[1]}" not found`);
    }
    // TODO: if current package / from has a scoped package name, url needs to
    // move an additional level up to get out of the current scoped dir.
    // jsUrlPieces.unshift('..');
    jsUrl = jsUrlPieces.join('/');
  }

  if (from !== undefined) {
    const fromJsUrl = htmlUrlToJs(from);
    jsUrl = path.relative(path.dirname(fromJsUrl), jsUrl);
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

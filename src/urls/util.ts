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
import {Document} from 'polymer-analyzer';

import {ConvertedDocumentUrl, OriginalDocumentUrl} from './types';

/** The HTML file extension. */
export const htmlExtension = '.html';

/** The JavaScript file extension. */
export const jsExtension = '.js';

/**
 * Rewrite a url to replace a `.js` file extension with `.html`.
 */
export function fixHtmlExtension(htmlUrl: string): string {
  return htmlUrl.substring(0, htmlUrl.length - htmlExtension.length) +
      jsExtension;
}

/**
 * Return a document url property as a OriginalDocumentUrl type.
 */
export function getDocumentUrl(document: Document): OriginalDocumentUrl {
  return document.url as OriginalDocumentUrl;
}

/**
 * Gets a relative URL from one JS module URL to another. Handles expected
 * formatting and relative/absolute urls.
 */
export function getRelativeUrl(
    fromUrl: ConvertedDocumentUrl, toUrl: ConvertedDocumentUrl): string {
  // Error: Expects two package-root-relative URLs to compute a relative path
  if (!fromUrl.startsWith('./') || !toUrl.startsWith('./')) {
    throw new Error(
        `paths relative to package root expected (actual: ` +
        `from="${fromUrl}", to="${toUrl}")`);
  }
  let moduleJsUrl = path.relative(path.dirname(fromUrl), toUrl);
  // Correct URL format to add './' preface if none exists
  if (!moduleJsUrl.startsWith('.') && !moduleJsUrl.startsWith('/')) {
    moduleJsUrl = './' + moduleJsUrl;
  }
  return moduleJsUrl;
}

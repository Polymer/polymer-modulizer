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

import {lookupDependencyMapping} from '../manifest-converter';

import {ConvertedDocumentFilePath, ConvertedDocumentUrl, OriginalDocumentUrl, PackageType} from './types';
import {UrlHandlerInterface} from './url-handler-interface';
import {getRelativeUrl} from './util';

const isInBowerComponentsRegex = /(\b|\/|\\)(bower_components)(\/|\\)/;
const isInNodeModulesRegex = /(\b|\/|\\)(node_modules)(\/|\\)/;

/**
 * Handle URLs in a single "package-based" layout. This converter should be used
 * to convert a single package, where all existing Bower dependencies are
 * installed in a "bower_components/" sub-directory inside the main package
 * directory.
 */
export class PackageUrlHandler implements UrlHandlerInterface {
  readonly packageName: string;
  readonly packageType: PackageType;

  /**
   * Helper function to check if a file URL is internal to the main package
   * being converted (vs. a dependency).
   */
  static isUrlInternalToPackage(url: ConvertedDocumentUrl|OriginalDocumentUrl|
                                ConvertedDocumentFilePath) {
    return !isInBowerComponentsRegex.test(url) &&
        !isInNodeModulesRegex.test(url);
  }

  constructor(packageName: string, packageType?: PackageType) {
    this.packageName = packageName;
    this.packageType = packageType || 'element';
  }

  /**
   * Get the converted NPM name for a package, given the original document URL
   * of any file that lives in that package.
   */
  getPackageNameForUrl(url: OriginalDocumentUrl) {
    if (PackageUrlHandler.isUrlInternalToPackage(url)) {
      return this.packageName;
    } else {
      // For a a single package layout, the Bower package name is included in
      // the URL. ie: bower_components/PACKAGE_NAME/...
      const basePackageName = url.split('/')[1];
      // Check the dependency map to get the new NPM name for the package.
      const depInfo = lookupDependencyMapping(basePackageName);
      if (!depInfo) {
        return basePackageName;
      }
      return depInfo.npm;
    }
  }

  /**
   * Get the "type" for the package where a file lives, based on it's URL.
   */
  getPackageTypeForUrl(url: OriginalDocumentUrl) {
    if (PackageUrlHandler.isUrlInternalToPackage(url)) {
      return this.packageType;
    } else {
      return 'element';
    }
  }

  /**
   * Check if two URLs are internal within the same package.
   */
  isImportInternal(fromUrl: ConvertedDocumentUrl, toUrl: ConvertedDocumentUrl) {
    if (fromUrl.startsWith('./node_modules') &&
        toUrl.startsWith('./node_modules')) {
      return true;
    }
    if (!fromUrl.startsWith('./node_modules') &&
        !toUrl.startsWith('./node_modules')) {
      return true;
    }
    return false;
  }

  /**
   * Update a Bower package name in a url (at path index) to its matching npm
   * package name.
   */
  convertUrl(url: OriginalDocumentUrl): ConvertedDocumentUrl {
    if (PackageUrlHandler.isUrlInternalToPackage(url)) {
      // TODO(fks): Revisit this format? The analyzer returns URLs without this
      return ('./' + url) as ConvertedDocumentUrl;
    }
    // Convert component folder name
    const newUrl = url.replace('bower_components/', 'node_modules/');
    // Convert package name
    const newUrlPieces = newUrl.split('/');
    const bowerPackageName = newUrlPieces[1];
    const depInfo = lookupDependencyMapping(bowerPackageName);
    if (depInfo) {
      newUrlPieces[1] = depInfo.npm;
    }
    return ('./' + newUrlPieces.join('/')) as ConvertedDocumentUrl;
  }

  /**
   * Get the formatted import URL between two ConvertedDocumentUrls.
   */
  getPathImportUrl(fromUrl: ConvertedDocumentUrl, toUrl: ConvertedDocumentUrl):
      string {
    const isPackageNameScoped = this.packageName.includes('/');
    const isPackageTypeElement = this.packageType === 'element';
    const isImportFromLocalFile =
        PackageUrlHandler.isUrlInternalToPackage(fromUrl);
    const isImportToExternalFile =
        !PackageUrlHandler.isUrlInternalToPackage(toUrl);
    let importUrl = getRelativeUrl(fromUrl, toUrl);

    // If the import is from the current project:
    if (isImportFromLocalFile && isPackageTypeElement) {
      // Rewrite imports to point to dependencies as if they were siblings.
      if (importUrl.startsWith('./node_modules/')) {
        importUrl = '../' + importUrl.slice('./node_modules/'.length);
      } else {
        importUrl = importUrl.replace('node_modules', '..');
      }
      // Account for a npm package name scoping.
      if (isPackageNameScoped && isImportToExternalFile) {
        if (importUrl.startsWith('./')) {
          importUrl = '../' + importUrl.slice('./'.length);
        } else {
          importUrl = '../' + importUrl;
        }
      }
    }

    return importUrl;
  }
}

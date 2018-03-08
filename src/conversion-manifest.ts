/**
 * @license
 * Copyright (c) 2018 The Polymer Project Authors. All rights reserved.
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


import {JsModuleScanResult, ScanResult} from './document-converter';
import {JsExport} from './js-module';
import {PackageScanExports, PackageScanFiles} from './package-scanner';
import {ConvertedDocumentFilePath, ConvertedDocumentUrl, OriginalDocumentUrl} from './urls/types';
import {UrlHandler} from './urls/url-handler';
import {replaceHtmlExtensionIfFound} from './urls/util';

interface FileExportJson {
  name: string;
  id: string;
}
interface PackageFileJson {
  url: string;
  exports: FileExportJson[];
}
type PackageFilesJson = {
  [originalFilePath: string]: null|PackageFileJson
};
export interface PackageScanResultJson { files: PackageFilesJson; }

function filterExportsByFile(
    scanResult: JsModuleScanResult, exportsMap: PackageScanExports) {
  const fileExports = [];
  for (const exportData of scanResult.exportMigrationRecords) {
    const globalExport = exportsMap.get(exportData.oldNamespacedName);
    if (globalExport) {
      fileExports.push(
          {id: exportData.oldNamespacedName, name: globalExport.name});
    }
  }
  return fileExports;
}

/**
 * Convert a single file scan result to a serializable JSON object.
 */
function serializePackageFileScanResult(
    fileScanResult: ScanResult,
    exportsMap: PackageScanExports,
    urlHandler: UrlHandler): PackageFileJson|null {
  if (fileScanResult.type === 'delete-file') {
    return null;
  }
  const {convertedFilePath} = fileScanResult;
  const convertedRelativePath =
      urlHandler.convertedDocumentFilePathToPackageRelative(convertedFilePath);
  if (fileScanResult.type === 'html-document') {
    return {
      url: convertedRelativePath,
      exports: [],
    };
  }
  return {
    url: convertedRelativePath,
    exports: filterExportsByFile(fileScanResult, exportsMap),
  };
}

/**
 * Convert a map of files to a serializable JSON object.
 */
export function serializePackageScanResult(
    filesMap: PackageScanFiles,
    exportsMap: PackageScanExports,
    urlHandler: UrlHandler): PackageScanResultJson {
  const filesObject: PackageFilesJson = {};
  for (const [originalFilePath, scanResult] of filesMap) {
    const originalRelativeUrl =
        urlHandler.originalUrlToPackageRelative(originalFilePath);
    filesObject[originalRelativeUrl] =
        serializePackageFileScanResult(scanResult, exportsMap, urlHandler);
  }
  return {files: filesObject};
}

function fileMappingToScanResult(
    originalUrl: OriginalDocumentUrl,
    convertedUrl: ConvertedDocumentUrl|null,
    fileData: PackageFileJson): ScanResult {
  if (!convertedUrl) {
    return {
      type: 'delete-file',
      originalUrl: originalUrl,
      convertedUrl: undefined,
      convertedFilePath: undefined,
    };
  }
  if (convertedUrl.endsWith('.html')) {
    return {
      type: 'html-document',
      originalUrl: originalUrl,
      convertedUrl: convertedUrl,
      convertedFilePath: originalUrl as string as ConvertedDocumentFilePath,
    };
  }
  return {
    type: 'js-module',
    originalUrl: originalUrl,
    convertedUrl: convertedUrl,
    convertedFilePath: replaceHtmlExtensionIfFound(originalUrl) as ConvertedDocumentFilePath,
    exportMigrationRecords: fileData.exports.map((ex) => ({
                                                   oldNamespacedName: ex.id,
                                                   es6ExportName: ex.name,
                                                 })),
  };
}

export function filesJsonObjectToMap(
    originalPackageName: string,
    convertedPackageName: string,
    conversionManifest: PackageScanResultJson,
    urlHandler: UrlHandler): [PackageScanFiles, PackageScanExports] {
  const filesMap: PackageScanFiles = new Map();
  const exportsMap: PackageScanExports = new Map();
  for (const [relativeFromUrl, fileData] of Object.entries(
           conversionManifest.files)) {
    const originalUrl = urlHandler.packageRelativeToOriginalUrl(
        originalPackageName, relativeFromUrl);
    const convertedUrl = fileData === null ?
        null :
        urlHandler.packageRelativeToConvertedUrl(
            convertedPackageName, fileData.url);
    filesMap.set(
        originalUrl,
        fileMappingToScanResult(originalUrl, convertedUrl, fileData!));
  }
  for (const [_originalUrl, scanResult] of filesMap) {
    if (scanResult.type !== 'js-module') {
      continue;
    }
    for (const namespacedExports of scanResult.exportMigrationRecords) {
      exportsMap.set(
          namespacedExports.oldNamespacedName,
          new JsExport(
              scanResult.convertedUrl, namespacedExports.es6ExportName));
    }
  }
  return [filesMap, exportsMap];
}

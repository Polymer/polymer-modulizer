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

import {Document} from 'polymer-analyzer';

import {ConversionSettings} from './conversion-settings';
import {DocumentConverter} from './document-converter';
import {ConversionResult, JsExport} from './js-module';
import {ConvertedDocumentFilePath, OriginalDocumentUrl} from './urls/types';
import {UrlHandlerInterface} from './urls/url-handler-interface';
import {getDocumentUrl} from './urls/util';

/**
 * ProjectConverter provides the top-level interface for running a project
 * conversion. convertDocument() should be called to kick off any conversion,
 * and getResults() should be called once conversion is complete.
 *
 * For best results, only one ProjectConverter instance should be needed, so
 * that it can cache results and avoid duplicate, extraneous document
 * conversions.
 *
 * ProjectConverter is indifferent to the layout of the project, delegating any
 * special URL handling/resolution to the urlHandler provided to the
 * constructor.
 */
export class ProjectConverter {
  readonly urlHandler: UrlHandlerInterface;
  readonly conversionSettings: ConversionSettings;

  /**
   * A cache of all JS Exports by namespace, to map implicit HTML imports to
   * explicit named JS imports.
   */
  readonly namespacedExports = new Map<string, JsExport>();
  /**
   * A cache of all converted documents. Document conversions should be
   * idempotent, so conversion results can be safely cached.
   */
  readonly conversionResults = new Map<OriginalDocumentUrl, ConversionResult>();

  constructor(
      urlHandler: UrlHandlerInterface, conversionSettings: ConversionSettings) {
    this.urlHandler = urlHandler;
    this.conversionSettings = conversionSettings;
  }

  /**
   * Convert a document and any of its dependencies. The output format (JS
   * Module or HTML Document) is determined by whether the file is included in
   * conversionSettings.includes.
   */
  convertDocument(document: Document) {
    try {
      this.conversionSettings.includes.has(document.url) ?
          this.convertDocumentToJs(document, new Set()) :
          this.convertDocumentToHtml(document, new Set());
    } catch (e) {
      console.error(`Error in ${document.url}`, e);
    }
  }

  /**
   * Specifically convert an HTML document to a JS module. Useful during
   * conversion for dependencies where the type of result is explictly expected.
   */
  convertDocumentToJs(document: Document, visited: Set<OriginalDocumentUrl>) {
    if (this.conversionResults.has(getDocumentUrl(document))) {
      return;
    }
    const documentConverter = new DocumentConverter(this, document, visited);
    const newModule = documentConverter.convertToJsModule();
    if (newModule) {
      this.handleConversionResult(newModule);
    }
  }

  /**
   * Specifically convert an HTML document without changing the file type
   * (changes imports and inline scripts to modules as necessary.) Useful during
   * conversion for dependencies where the type of result is explictly expected.
   */
  convertDocumentToHtml(document: Document, visited: Set<OriginalDocumentUrl>) {
    if (this.conversionResults.has(getDocumentUrl(document))) {
      return;
    }
    const documentConverter = new DocumentConverter(this, document, visited);
    const newModule = documentConverter.convertAsToplevelHtmlDocument();
    this.handleConversionResult(newModule);
  }

  /**
   * A private instance method for handling new conversion results, exports,
   * etc.
   */
  private handleConversionResult(newModule: ConversionResult): void {
    this.conversionResults.set(newModule.originalUrl, newModule);
    if (newModule.output.type === 'js-module') {
      for (const expr of newModule.output.exportedNamespaceMembers) {
        this.namespacedExports.set(
            expr.oldNamespacedName,
            new JsExport(newModule.convertedUrl, expr.es6ExportName));
      }
    }
  }

  /**
   * This method collects the results after all documents are converted. It
   * handles out some broken edge-cases (ex: shadycss) and sets empty map
   * entries for files to be deleted.
   */
  getResults(): Map<ConvertedDocumentFilePath, string|undefined> {
    const results = new Map<ConvertedDocumentFilePath, string|undefined>();

    for (const convertedModule of this.conversionResults.values()) {
      if (convertedModule.originalUrl.endsWith(
              'shadycss/entrypoints/apply-shim.js') ||
          convertedModule.originalUrl.endsWith(
              'shadycss/entrypoints/custom-style-interface.js')) {
        // These are already ES6, and messed with in url-handler.
        continue;
      }
      if (convertedModule.keepOriginal !== true) {
        results.set(
            convertedModule.originalUrl as string as ConvertedDocumentFilePath,
            undefined);
      }
      results.set(
          convertedModule.convertedFilePath, convertedModule.output.source);
    }

    return results;
  }
}

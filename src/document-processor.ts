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

import * as dom5 from 'dom5';
import {Program} from 'estree';
import * as jsc from 'jscodeshift';
import * as parse5 from 'parse5';
import {Document, Import, isPositionInsideRange, Severity, Warning} from 'polymer-analyzer';
import * as recast from 'recast';

import {ConversionSettings} from './conversion-settings';
import {attachCommentsToFirstStatement, canDomModuleBeInlined, createDomNodeInsertStatements, filterClone, getCommentsBetween, getNodePathInProgram, insertStatementsIntoProgramBody, serializeNodeToTemplateLiteral} from './document-util';
import {removeNamespaceInitializers} from './passes/remove-namespace-initializers';
import {removeToplevelUseStrict} from './passes/remove-toplevel-use-strict';
import {removeUnnecessaryEventListeners} from './passes/remove-unnecessary-waits';
import {removeWrappingIIFEs} from './passes/remove-wrapping-iife';
import {rewriteToplevelThis} from './passes/rewrite-toplevel-this';
import {ConvertedDocumentUrl, OriginalDocumentUrl} from './urls/types';
import {UrlHandler} from './urls/url-handler';
import {isOriginalDocumentUrlFormat} from './urls/util';
import {replaceHtmlExtensionIfFound} from './urls/util';

/**
 * Keep a set of elements to ignore when Recreating HTML contents by adding
 * code to the top of a program.
 */
const generatedElementBlacklist = new Set<string|undefined>([
  'base',
  'link',
  'meta',
  'script',
]);

/**
 * An abstract superclass for our document scanner and document converters.
 */
export abstract class DocumentProcessor {
  protected readonly originalUrl: OriginalDocumentUrl;
  /**
   * N.B. that this converted url always points to .js, even if this document
   * will be converted to an HTML file.
   */
  protected readonly convertedUrl: ConvertedDocumentUrl;
  protected readonly urlHandler: UrlHandler;
  protected readonly conversionSettings: ConversionSettings;
  protected readonly document: Document;
  protected readonly program: Program;
  protected readonly convertedHtmlScripts: ReadonlySet<Import>;

  constructor(
      document: Document, urlHandler: UrlHandler,
      conversionSettings: ConversionSettings) {
    this.conversionSettings = conversionSettings;
    this.urlHandler = urlHandler;
    this.document = document;
    this.originalUrl = urlHandler.getDocumentUrl(document);
    this.convertedUrl = this.convertDocumentUrl(this.originalUrl);
    ({program: this.program, convertedHtmlScripts: this.convertedHtmlScripts} =
         this.prepareJsModule());
  }

  private isInternalNonModuleImport(scriptImport: Import): boolean {
    const oldScriptUrl = this.urlHandler.getDocumentUrl(scriptImport.document);
    const newScriptUrl = this.convertScriptUrl(oldScriptUrl);
    const isModuleImport =
        dom5.getAttribute(scriptImport.astNode, 'type') === 'module';
    const isInternalImport =
        this.urlHandler.isImportInternal(this.convertedUrl, newScriptUrl);
    return isInternalImport && !isModuleImport;
  }

  /**
   * Creates a single program from all the JavaScript in the current document.
   * The standard program result can be used for either scanning or conversion.
   *
   * TODO: this does a lot of mutation of the program. Could we only do that
   *   when we're converting, and not when we're scanning?
   */
  private prepareJsModule() {
    const combinedToplevelStatements = [];
    const convertedHtmlScripts = new Set<Import>();
    const claimedDomModules = new Set<parse5.ASTNode>();
    let prevScriptNode: parse5.ASTNode|undefined = undefined;
    for (const script of this.document.getFeatures()) {
      let scriptDocument: Document;
      if (script.kinds.has('html-script') &&
          this.isInternalNonModuleImport(script as Import)) {
        scriptDocument = (script as Import).document;
        convertedHtmlScripts.add(script as Import);
      } else if (script.kinds.has('js-document')) {
        scriptDocument = script as Document;
      } else {
        continue;
      }
      const scriptProgram =
          recast.parse(scriptDocument.parsedDocument.contents).program;
      rewriteToplevelThis(scriptProgram);
      removeToplevelUseStrict(scriptProgram);
      // We need to inline templates on a per-script basis, otherwise we run
      // into trouble matching up analyzer AST nodes with our own.
      const localClaimedDomModules =
          this.inlineTemplates(scriptProgram, scriptDocument);
      for (const claimedDomModule of localClaimedDomModules) {
        claimedDomModules.add(claimedDomModule);
      }
      if (this.conversionSettings.addImportPath) {
        this.addImportPathsToElements(scriptProgram, scriptDocument);
      }
      const comments: string[] = getCommentsBetween(
          this.document.parsedDocument.ast, prevScriptNode, script.astNode);
      const statements =
          attachCommentsToFirstStatement(comments, scriptProgram.body);
      combinedToplevelStatements.push(...statements);
      prevScriptNode = script.astNode;
    }

    const trailingComments = getCommentsBetween(
        this.document.parsedDocument.ast, prevScriptNode, undefined);
    const maybeCommentStatement =
        attachCommentsToFirstStatement(trailingComments, []);
    combinedToplevelStatements.push(...maybeCommentStatement);
    const program = jsc.program(combinedToplevelStatements);
    removeUnnecessaryEventListeners(program);
    removeWrappingIIFEs(program);

    this.insertCodeToGenerateHtmlElements(program, claimedDomModules);
    removeNamespaceInitializers(program, this.conversionSettings.namespaces);

    return {program, convertedHtmlScripts};
  }

  /**
   * Recreate the HTML contents from the original HTML document by adding
   * code to the top of program that constructs equivalent DOM and insert
   * it into `window.document`.
   */
  private insertCodeToGenerateHtmlElements(
      program: Program, claimedDomModules: Set<parse5.ASTNode>) {
    const ast = this.document.parsedDocument.ast as parse5.ASTNode;
    if (ast.childNodes === undefined) {
      return;
    }
    const htmlElement = ast.childNodes!.find((n) => n.tagName === 'html');
    const head = htmlElement!.childNodes!.find((n) => n.tagName === 'head')!;
    const body = htmlElement!.childNodes!.find((n) => n.tagName === 'body')!;
    const elements = [
      ...head.childNodes!.filter(
          (n: parse5.ASTNode) => n.tagName !== undefined),
      ...body.childNodes!.filter((n: parse5.ASTNode) => n.tagName !== undefined)
    ];

    const genericElements = filterClone(elements, (e) => {
      return !(
          generatedElementBlacklist.has(e.tagName) || claimedDomModules.has(e));
    });
    if (genericElements.length === 0) {
      return;
    }
    const statements = createDomNodeInsertStatements(genericElements);
    insertStatementsIntoProgramBody(statements, program);
  }

  /**
   * Find Polymer element templates in the original HTML. Insert these
   * templates as strings as part of the javascript element declaration.
   */
  private inlineTemplates(program: Program, scriptDocument: Document) {
    const elements = scriptDocument.getFeatures({'kind': 'polymer-element'});
    const claimedDomModules = new Set<parse5.ASTNode>();

    for (const element of elements) {
      // This is an analyzer wart. There's no way to avoid getting features
      // from the containing document when querying an inline document. Filed
      // as https://github.com/Polymer/polymer-analyzer/issues/712
      if (element.sourceRange === undefined ||
          !isPositionInsideRange(
              element.sourceRange.start, scriptDocument.sourceRange)) {
        continue;
      }
      const domModule = element.domModule;
      if (domModule === undefined) {
        continue;
      }
      if (!canDomModuleBeInlined(domModule)) {
        continue;
      }
      claimedDomModules.add(domModule);
      const template = dom5.query(domModule, (e) => e.tagName === 'template');
      if (template === null) {
        continue;
      }

      // It's ok to tag templates with the expression `Polymer.html` without
      // adding an import because `Polymer.html` is re-exported by both
      // polymer.html and polymer-element.html and, crucially, template
      // inlining happens before rewriting references.
      const templateLiteral = jsc.taggedTemplateExpression(
          jsc.memberExpression(
              jsc.identifier('Polymer'), jsc.identifier('html')),
          serializeNodeToTemplateLiteral(
              parse5.treeAdapters.default.getTemplateContent(template)));
      const nodePath = getNodePathInProgram(program, element.astNode);

      if (nodePath === undefined) {
        console.warn(
            new Warning({
              code: 'not-found',
              message: `Can't find recast node for element ${element.tagName}`,
              parsedDocument: this.document.parsedDocument,
              severity: Severity.WARNING,
              sourceRange: element.sourceRange!
            }).toString());
        continue;
      }

      const node = nodePath.node;
      if (node.type === 'ClassDeclaration' || node.type === 'ClassExpression') {
        // A Polymer 2.0 class-based element
        node.body.body.splice(
            0,
            0,
            jsc.methodDefinition(
                'get',
                jsc.identifier('template'),
                jsc.functionExpression(
                    null, [], jsc.blockStatement([jsc.returnStatement(
                                  templateLiteral)])),
                true));
      } else if (node.type === 'CallExpression') {
        // A Polymer hybrid/legacy factory function element
        const arg = node.arguments[0];
        if (arg && arg.type === 'ObjectExpression') {
          arg.properties.unshift(jsc.property(
              'init', jsc.identifier('_template'), templateLiteral));
        }
      } else {
        console.error(`Internal Error, Class or CallExpression expected, got ${
            node.type}`);
      }
    }
    return claimedDomModules;
  }

  /**
   * Adds a static importPath property to Polymer elements.
   */
  private addImportPathsToElements(program: Program, scriptDocument: Document) {
    const elements = scriptDocument.getFeatures({'kind': 'polymer-element'});

    for (const element of elements) {
      // This is an analyzer wart. There's no way to avoid getting features
      // from the containing document when querying an inline document. Filed
      // as https://github.com/Polymer/polymer-analyzer/issues/712
      if (element.sourceRange === undefined ||
          !isPositionInsideRange(
              element.sourceRange.start, scriptDocument.sourceRange)) {
        continue;
      }

      const nodePath = getNodePathInProgram(program, element.astNode);

      if (nodePath === undefined) {
        console.warn(
            new Warning({
              code: 'not-found',
              message: `Can't find recast node for element ${element.tagName}`,
              parsedDocument: this.document.parsedDocument,
              severity: Severity.WARNING,
              sourceRange: element.sourceRange!
            }).toString());
        continue;
      }

      const importMetaUrl = jsc.memberExpression(
          jsc.memberExpression(
              jsc.identifier('import'), jsc.identifier('meta')),
          jsc.identifier('url'));

      const node = nodePath.node;
      if (node.type === 'ClassDeclaration' || node.type === 'ClassExpression') {
        // A Polymer 2.0 class-based element
        const getter = jsc.methodDefinition(
            'get',
            jsc.identifier('importPath'),
            jsc.functionExpression(
                null,
                [],
                jsc.blockStatement([jsc.returnStatement(importMetaUrl)])),
            true);
        node.body.body.splice(0, 0, getter);
      } else if (node.type === 'CallExpression') {
        // A Polymer hybrid/legacy factory function element
        const arg = node.arguments[0];
        if (arg && arg.type === 'ObjectExpression') {
          arg.properties.unshift(jsc.property(
              'init', jsc.identifier('importPath'), importMetaUrl));
        }
      } else {
        console.error(`Internal Error, Class or CallExpression expected, got ${
            node.type}`);
      }
    }
  }



  /**
   * Converts an HTML Document's path from old world to new. Use new NPM naming
   * as needed in the path, and change any .html extension to .js.
   */
  protected convertDocumentUrl(htmlUrl: OriginalDocumentUrl):
      ConvertedDocumentUrl {
    // TODO(fks): This can be removed later if type-checking htmlUrl is enough
    if (!isOriginalDocumentUrlFormat(htmlUrl)) {
      throw new Error(
          `convertDocumentUrl() expects an OriginalDocumentUrl string` +
          `from the analyzer, but got "${htmlUrl}"`);
    }
    // Use the layout-specific UrlHandler to convert the URL.
    let jsUrl: string = this.urlHandler.convertUrl(htmlUrl);
    // Temporary workaround for imports of some shadycss files that wrapped
    // ES6 modules.
    if (jsUrl.endsWith('shadycss/apply-shim.html')) {
      jsUrl = jsUrl.replace(
          'shadycss/apply-shim.html', 'shadycss/entrypoints/apply-shim.js');
    }
    if (jsUrl.endsWith('shadycss/custom-style-interface.html')) {
      jsUrl = jsUrl.replace(
          'shadycss/custom-style-interface.html',
          'shadycss/entrypoints/custom-style-interface.js');
    }
    // Convert any ".html" URLs to point to their new ".js" module equivilent
    jsUrl = replaceHtmlExtensionIfFound(jsUrl);
    return jsUrl as ConvertedDocumentUrl;
  }

  /**
   * Converts the URL for a script that is already being loaded in a
   * pre-conversion HTML document via the <script> tag. This is similar to
   * convertDocumentUrl(), but can skip some of the more complex .html -> .js
   * conversion/rewriting.
   */
  protected convertScriptUrl(oldUrl: OriginalDocumentUrl):
      ConvertedDocumentUrl {
    // TODO(fks): This can be removed later if type-checking htmlUrl is enough
    if (!isOriginalDocumentUrlFormat(oldUrl)) {
      throw new Error(
          `convertDocumentUrl() expects an OriginalDocumentUrl string` +
          `from the analyzer, but got "${oldUrl}"`);
    }
    // Use the layout-specific UrlHandler to convert the URL.
    return this.urlHandler.convertUrl(oldUrl);
  }
}

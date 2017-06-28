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

import * as fs from 'mz/fs';
import * as path from 'path';
import { Analyzer, FSUrlLoader, PackageUrlResolver } from "polymer-analyzer/lib";
import { AnalysisConverterOptions, AnalysisConverter } from "./analysis-converter";

const mkdirp = require('mkdirp');

function generatePackageJson(bowerJson: any, npmName: string, npmVersion?: string) {
  return {
    name: npmName,
    flat: true,
    version: npmVersion || bowerJson.version,
    description: bowerJson.description,
    author: bowerJson.author,
    contributors: bowerJson.contributors || bowerJson.authors,
    keywords: bowerJson.keywords,
    main: (typeof bowerJson.main === 'string') ? bowerJson.main : undefined,
    repository: bowerJson.repository,
    homepage: bowerJson.homepage,
    dependencies: {},
    devDependencies: {}
  };
}

type ConvertPackageOptions = AnalysisConverterOptions & {

  /**
   * The directory to write converted JavaScript files to.
   */
  outDir?: string;

  /**
   * The npm package name to use in package.json
   */
  packageName?: string;

  npmVersion?: string;
};

/**
 * Converts an entire package from HTML imports to JS modules
 */
export async function convertPackage(options: ConvertPackageOptions = {}) {
  const outDir = options && (options.outDir) || 'js_out';
  const outDirResolved = path.resolve(process.cwd(), outDir);
  console.log(`Out directory: ${outDirResolved}`);

  try {
    await fs.mkdir(outDirResolved);
  } catch (e) {
    if (e.errno !== -17) { // directory exists
      console.error(e);
    }
  }

  const analyzer = new Analyzer({
    urlLoader: new FSUrlLoader(process.cwd()),
    urlResolver: new PackageUrlResolver(),
  });
  const analysis = await analyzer.analyzePackage();

  // TODO(justinfagnani): These setting are only good for Polymer core and should be
  // extracted into a config file
  const npmPackageName = options.packageName || '@polymer/polymer';
  const npmPackageVersion = options.npmVersion;
  const converter = new AnalysisConverter(analysis, {
    rootModuleName: options.rootModuleName || 'Polymer',
    excludes: options.excludes || [
      'lib/elements/dom-module.html',
    ],
    referenceExcludes: options.referenceExcludes || [
      'Polymer.DomModule',
      'Polymer.Settings',
      'Polymer.log',
      'Polymer.rootPath',
      'Polymer.sanitizeDOMValue'
    ],
    mutableExports: options.mutableExports || {
      'Polymer.telemetry': ['instanceCount'],
    },
  });

  try {
    const results = await converter.convert();
    for (const [jsUrl, newSource] of results!) {
      const outPath = path.resolve(outDirResolved, jsUrl);
      const jsDir = path.dirname(outPath);
      // console.log(`writing ${outPath}`);
      mkdirp.sync(jsDir);
      // console.log(`created dir ${jsDir}`);
      await fs.writeFile(outPath, newSource);
    }
  } catch (e) {
    console.log('error in codebase conversion');
    console.error(e);
  }

  try {
    const bowerJsonPath = path.resolve('bower.json');
    const bowerJson = await fs.readFile(bowerJsonPath);
    const packageJsonPath = path.resolve(outDir, 'package.json');
    const packageJson = generatePackageJson(bowerJson, npmPackageName, npmPackageVersion);
    await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, undefined, 2));
  } catch (e) {
    console.log('error in bower.json -> package.json conversion');
    console.error(e);
  }

}
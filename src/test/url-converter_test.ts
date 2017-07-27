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

import {assert} from 'chai';

// import * as path from 'path';
import {convertRelativeUrl, convertRootUrl} from '../url-converter';

suite('src/url-converter', () => {

  suite('convertRootUrl()', () => {

    test('converts a local html url to expected js url', () => {
      assert.equal(convertRootUrl('foo.html'), './foo.js');
      assert.equal(convertRootUrl('foo/foo.html'), './foo/foo.js');
    });

    test(
        'converts a bower_components/ (external) html url to expected js url',
        () => {
          assert.equal(
              convertRootUrl('bower_components/polymer/polymer.html'),
              './node_modules/@polymer/polymer/polymer.js');
          assert.equal(
              convertRootUrl('bower_components/paper-item/src/paper-item.html'),
              './node_modules/@polymer/paper-item/src/paper-item.js');
          assert.equal(
              convertRootUrl(
                  'bower_components/promise-polyfill/promise-polyfill.html'),
              './node_modules/@polymer/promise-polyfill/promise-polyfill.js');
        });


    test('handles special whitelisted url conversions', () => {
      assert.equal(
          convertRootUrl('bower_components/shadycss/apply-shim.html'),
          './node_modules/@webcomponents/shadycss/entrypoints/apply-shim.js');
      assert.equal(
          convertRootUrl(
              'bower_components/shadycss/custom-style-interface.html'),
          './node_modules/@webcomponents/shadycss/entrypoints/custom-style-interface.js');
    });

  });

  suite('convertRelativeUrl()', () => {

    test('handles two root urls relative to the same directory', () => {
      assert.equal(convertRelativeUrl('./foo.js', './bar.js'), './bar.js');
      assert.equal(convertRelativeUrl('./foo/foo.js', './bar.js'), '../bar.js');
      assert.equal(
          convertRelativeUrl('./foo/foo.js', './bar/bar.js'), '../bar/bar.js');
    });

    test('explicitly does not handle sibling/parent urls', () => {
      assert.throws(() => {
        convertRelativeUrl('../foo.js', './bar.js');
      }, 'paths relative to root expected (actual: from="../foo.js", to="./bar.js")');
    });

  });

});

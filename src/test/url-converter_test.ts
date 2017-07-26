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
import {htmlUrlToJs, jsUrlRelative} from '../url-converter';

console.log(typeof htmlUrlToJs);

suite('src/url-converter', () => {

  suite('jsUrlRelative()', () => {

    test('handles relative urls', () => {
      assert.equal(jsUrlRelative('./foo.html', './bar.html'), './bar.html');
      assert.equal(jsUrlRelative('foo.html', 'bar.html'), './bar.html');
      assert.equal(
          jsUrlRelative('./foo/foo.html', './bar.html'), '../bar.html');
      assert.equal(jsUrlRelative('foo/foo.html', 'bar.html'), '../bar.html');
      assert.equal(
          jsUrlRelative('./foo/foo.html', './bar/bar.html'), '../bar/bar.html');
      assert.equal(
          jsUrlRelative('foo/foo.html', 'bar/bar.html'), '../bar/bar.html');
    });

    test('handles absolute urls', () => {
      assert.equal(jsUrlRelative('foo.html', '/bar.html'), '/bar.html');
      assert.equal(jsUrlRelative('./foo.html', '/bar.html'), '/bar.html');
      assert.equal(jsUrlRelative('./foo/foo.html', '/bar.html'), '/bar.html');
      assert.equal(
          jsUrlRelative('./foo/foo.html', '/bar/bar.html'), '/bar/bar.html');
    });

    test('handles relative urls', () => {
      assert.equal(jsUrlRelative('foo.html', '../bar.html'), '../bar.html');
      assert.equal(jsUrlRelative('./foo.html', '../bar.html'), '../bar.html');
      assert.equal(
          jsUrlRelative('./foo/foo.html', '../bar.html'), '../../bar.html');
    });

    test('explicitly does not handle sibling/parent urls', () => {
      assert.throws(() => {
        jsUrlRelative('../foo.html', './bar.html');
      }, 'paths relative to root expected (actual: from="../foo.html")');
    });

  });

  suite('htmlUrlToJs(toUrl)', () => {

    test('converts a local html url to expected js url', () => {
      assert.equal(htmlUrlToJs('foo.html'), './foo.js');
      assert.equal(htmlUrlToJs('./foo.html'), './foo.js');
      assert.equal(htmlUrlToJs('./foo/foo.html'), './foo/foo.js');
    });

    test('converts a sibling (external) html url to expected js url', () => {
      assert.equal(
          htmlUrlToJs('../polymer/polymer.html'),
          '../@polymer/polymer/polymer.js');
      assert.equal(
          htmlUrlToJs('../paper-item/src/paper-item.html'),
          '../@polymer/paper-item/src/paper-item.js');
      assert.equal(
          htmlUrlToJs('../promise-polyfill/promise-polyfill.html'),
          '../@polymer/promise-polyfill/promise-polyfill.js');
    });

    test(
        'converts a ./bower_components/ (external) html url to expected js url',
        () => {
          assert.equal(
              htmlUrlToJs('bower_components/polymer/polymer.html'),
              './node_modules/@polymer/polymer/polymer.js');
          assert.equal(
              htmlUrlToJs('./bower_components/paper-item/src/paper-item.html'),
              './node_modules/@polymer/paper-item/src/paper-item.js');
          assert.equal(
              htmlUrlToJs(
                  './bower_components/promise-polyfill/promise-polyfill.html'),
              './node_modules/@polymer/promise-polyfill/promise-polyfill.js');
        });


    test('handles special whitelisted url conversions', () => {
      assert.equal(
          htmlUrlToJs('./bower_components/shadycss/apply-shim.html'),
          './node_modules/@webcomponents/shadycss/entrypoints/apply-shim.js');
      assert.equal(
          htmlUrlToJs('./bower_components/shadycss/custom-style-interface.html'),
          './node_modules/@webcomponents/shadycss/entrypoints/custom-style-interface.js');
    });

  });

  suite('htmlUrlToJs(toUrl, fromUrl)', () => {

    test(
        'converts a local html url, relative to another local html url', () => {
          assert.equal(htmlUrlToJs('foo.html', 'bar.html'), './foo.js');
          assert.equal(htmlUrlToJs('./foo.html', './bar.html'), './foo.js');
          assert.equal(
              htmlUrlToJs('./foo/foo.html', './bar.html'), './foo/foo.js');
          assert.equal(
              htmlUrlToJs('./foo/foo.html', './bar/bar.html'), '../foo/foo.js');
        });

    test('converts an external html url, relative to a local html url', () => {
      assert.equal(
          htmlUrlToJs('./bower_components/polymer/polymer.html', 'foo.html'),
          './node_modules/@polymer/polymer/polymer.js');
      assert.equal(
          htmlUrlToJs(
              './bower_components/polymer/polymer.html', './foo/foo.html'),
          '../node_modules/@polymer/polymer/polymer.js');
      assert.equal(
          htmlUrlToJs('../polymer/polymer.html', 'foo.html'),
          '../@polymer/polymer/polymer.js');
      assert.equal(
          htmlUrlToJs('../polymer/polymer.html', './foo/foo.html'),
          '../../@polymer/polymer/polymer.js');
    });

    test(
        'converts an external html url, relative to another external html url',
        () => {
          assert.equal(
              htmlUrlToJs(
                  './bower_components/polymer/foobar.html',
                  './bower_components/polymer/polymer.html'),
              './foobar.js');
          assert.equal(
              htmlUrlToJs(
                  '../polymer/polymer.html',
                  './bower_components/paper-button/paper-button.html'),
              '../polymer/polymer.js');
          assert.equal(
              htmlUrlToJs(
                  './bower_components/polymer/polymer.html',
                  './bower_components/paper-button/paper-button.html'),
              '../polymer/polymer.js');
          assert.equal(
              htmlUrlToJs(
                  '../webcomponentsjs/foo.html',
                  './bower_components/polymer/polymer.html'),
              '../../@webcomponents/webcomponentsjs/foo.js');
          assert.equal(
              htmlUrlToJs(
                  './bower_components/webcomponentsjs/foo.html',
                  './bower_components/polymer/polymer.html'),
              '../../@webcomponents/webcomponentsjs/foo.js');
        });

  });

});

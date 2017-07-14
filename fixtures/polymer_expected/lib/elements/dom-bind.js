import '../utils/boot.js';
import { PropertyEffects as $PropertyEffects } from '../mixins/property-effects.js';
import { OptionalMutableData as $OptionalMutableData } from '../mixins/mutable-data.js';
import { GestureEventListeners as $GestureEventListeners } from '../mixins/gesture-event-listeners.js';

/**
 * @constructor
 * @implements {Polymer_PropertyEffects}
 * @implements {Polymer_OptionalMutableData}
 * @implements {Polymer_GestureEventListener}
 * @extends {HTMLElement}
 */
const domBindBase =
  $GestureEventListeners(
    $OptionalMutableData(
      $PropertyEffects(HTMLElement)));

/**
 * Custom element to allow using Polymer's template features (data binding,
 * declarative event listeners, etc.) in the main document without defining
 * a new custom element.
 *
 * `<template>` tags utilizing bindings may be wrapped with the `<dom-bind>`
 * element, which will immediately stamp the wrapped template into the main
 * document and bind elements to the `dom-bind` element itself as the
 * binding scope.
 *
 * @extends HTMLElement
 * @mixes Polymer.PropertyEffects
 * @memberof Polymer
 * @summary Custom element to allow using Polymer's template features (data
 *   binding, declarative event listeners, etc.) in the main document.
 */
class DomBind extends domBindBase {

  static get observedAttributes() { return ['mutable-data'] }

  // assumes only one observed attribute
  attributeChangedCallback() {
    this.mutableData = true;
  }

  connectedCallback() {
    this.render();
  }

  disconnectedCallback() {
    this.__removeChildren();
  }

  __insertChildren() {
    this.parentNode.insertBefore(this.root, this);
  }

  __removeChildren() {
    if (this.__children) {
      for (let i=0; i<this.__children.length; i++) {
        this.root.appendChild(this.__children[i]);
      }
    }
  }

  /**
   * Forces the element to render its content. This is typically only
   * necessary to call if HTMLImports with the async attribute are used.
   */
  render() {
    let template;
    if (!this.__children) {
      template = template || this.querySelector('template');
      if (!template) {
        // Wait until childList changes and template should be there by then
        let observer = new MutationObserver(() => {
          template = this.querySelector('template');
          if (template) {
            observer.disconnect();
            this.render(template);
          } else {
            throw new Error('dom-bind requires a <template> child');
          }
        })
        observer.observe(this, {childList: true});
        return;
      }
      this.root = this._stampTemplate(template);
      this.$ = this.root.$;
      this.__children = [];
      for (let n=this.root.firstChild; n; n=n.nextSibling) {
        this.__children[this.__children.length] = n;
      }
      this._enableProperties();
    }
    this.__insertChildren();
    this.dispatchEvent(new CustomEvent('dom-change', {
      bubbles: true,
      composed: true
    }));
  }

}

customElements.define('dom-bind', DomBind);

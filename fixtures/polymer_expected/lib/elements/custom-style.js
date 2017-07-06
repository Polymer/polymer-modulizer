import { cssFromModules as $cssFromModules } from '../utils/style-gather.js';

const attr = 'include';

const CustomStyleInterface = window.ShadyCSS.CustomStyleInterface;

/**
 * Custom element for defining styles in the main document that can take
 * advantage of several special features of Polymer's styling system:
 *
 * - Document styles defined in a custom-style are shimmed to ensure they
 *   do not leak into local DOM when running on browsers without native
 *   Shadow DOM.
 * - Custom properties used by Polymer's shim for cross-scope styling may
 *   be defined in an custom-style. Use the :root selector to define custom
 *   properties that apply to all custom elements.
 *
 * To use, simply wrap an inline `<style>` tag in the main document whose
 * CSS uses these features with a `<custom-style>` element.
 *
 * @extends HTMLElement
 * @memberof Polymer
 * @summary Custom element for defining styles in the main document that can
 *   take advantage of Polymer's style scoping and custom properties shims.
 */
class CustomStyle extends HTMLElement {
  constructor() {
    super();
    this._style = null;
    CustomStyleInterface.addCustomStyle(this);
  }
  /**
   * Returns the light-DOM `<style>` child this element wraps.  Upon first
   * call any style modules referenced via the `include` attribute will be
   * concatenated to this element's `<style>`.
   *
   * @return {HTMLStyleElement} This element's light-DOM `<style>`
   */
  getStyle() {
    if (this._style) {
      return this._style;
    }
    const style = this.querySelector('style');
    if (!style) {
      return;
    }
    this._style = style;
    const include = style.getAttribute(attr);
    if (include) {
      style.removeAttribute(attr);
      style.textContent = $cssFromModules(include) + style.textContent;
    }
    return this._style;
  }
}

window.customElements.define('custom-style', CustomStyle);
export { CustomStyle };

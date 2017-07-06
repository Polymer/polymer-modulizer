import { ElementMixin as $ElementMixin } from './lib/mixins/element-mixin.js';

/**
 * Base class that provides the core API for Polymer's meta-programming
 * features including template stamping, data-binding, attribute deserialization,
 * and property change observation.
 *
 * @polymerElement
 * @memberof Polymer
 * @constructor
 * @implements {Polymer_ElementMixin}
 * @extends HTMLElement
 * @mixes Polymer.ElementMixin
 * @summary Custom element base class that provides the core API for Polymer's
 *   key meta-programming features including template stamping, data-binding,
 *   attribute deserialization, and property change observation
 */
const Element = $ElementMixin(HTMLElement);
export { Element };

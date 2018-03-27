import '../utils/boot.js';
import { dedupingMixin } from '../utils/mixin.js';
import * as gestures$0 from '../utils/gestures.js';

/**
 * @const {Polymer.Gestures}
 */
const gestures = gestures$0;

/**
 * Element class mixin that provides API for adding Polymer's cross-platform
 * gesture events to nodes.
 *
 * The API is designed to be compatible with override points implemented
 * in `Polymer.TemplateStamp` such that declarative event listeners in
 * templates will support gesture events when this mixin is applied along with
 * `Polymer.TemplateStamp`.
 *
 * @mixinFunction
 * @polymer
 * @summary Element class mixin that provides API for adding Polymer's cross-platform
 * gesture events to nodes
 */
export const GestureEventListeners = dedupingMixin(superClass => {

  /**
   * @polymer
   * @mixinClass
   * @implements {Polymer_GestureEventListeners}
   */
  class GestureEventListeners extends superClass {

    /**
     * Add the event listener to the node if it is a gestures event.
     *
     * @param {!Node} node Node to add event listener to
     * @param {string} eventName Name of event
     * @param {function(!Event):void} handler Listener function to add
     * @return {void}
     */
    _addEventListenerToNode(node, eventName, handler) {
      if (!gestures.addListener(node, eventName, handler)) {
        super._addEventListenerToNode(node, eventName, handler);
      }
    }

    /**
     * Remove the event listener to the node if it is a gestures event.
     *
     * @param {!Node} node Node to remove event listener from
     * @param {string} eventName Name of event
     * @param {function(!Event):void} handler Listener function to remove
     * @return {void}
     */
    _removeEventListenerFromNode(node, eventName, handler) {
      if (!gestures.removeListener(node, eventName, handler)) {
        super._removeEventListenerFromNode(node, eventName, handler);
      }
    }

  }

  return GestureEventListeners;

});

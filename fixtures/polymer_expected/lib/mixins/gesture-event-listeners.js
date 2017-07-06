import '../utils/boot.js';
import * as $$gestures from '../utils/gestures.js';
import { dedupingMixin as $dedupingMixin } from '../utils/mixin.js';

const gestures = $$gestures;

export const GestureEventListeners = $dedupingMixin(superClass => {

  /**
   * @polymerMixinClass
   * @implements {Polymer_GestureEventListeners}
   */
  class GestureEventListeners extends superClass {

    _addEventListenerToNode(node, eventName, handler) {
      if (!gestures.addListener(node, eventName, handler)) {
        super._addEventListenerToNode(node, eventName, handler);
      }
    }

    _removeEventListenerFromNode(node, eventName, handler) {
      if (!gestures.removeListener(node, eventName, handler)) {
        super._removeEventListenerFromNode(node, eventName, handler);
      }
    }

  }

  return GestureEventListeners;

});

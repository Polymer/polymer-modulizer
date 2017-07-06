import './boot.js';

// unique global id for deduping mixins.
let dedupeId = 0;

/**
 * Given a mixin producing function, memoize applications of mixin to base
 * @private
 * @param {Function} mixin Mixin for which to create a caching mixin.
 * @return {Function} Returns a mixin which when applied multiple times to the
 * same base will always return the same extended class.
 */
function cachingMixin(mixin) {
  return function(base) {
    if (!mixin.__mixinApplications) {
      mixin.__mixinApplications = new WeakMap();
    }
    let map = mixin.__mixinApplications;
    let application = map.get(base);
    if (!application) {
      application = mixin(base);
      map.set(base, application);
    }
    return application;
  };
}

export const dedupingMixin = function(mixin) {
  mixin = cachingMixin(mixin);
  // maintain a unique id for each mixin
  mixin.__dedupeId = ++dedupeId;
  return function(base) {
    let baseSet = base.__mixinSet;
    if (baseSet && baseSet[mixin.__dedupeId]) {
      return base;
    }
    let extended = mixin(base);
    // copy inherited mixin set from the extended class, or the base class
    // NOTE: we avoid use of Set here because some browser (IE11)
    // cannot extend a base Set via the constructor.
    extended.__mixinSet =
      Object.create(extended.__mixinSet || baseSet || null);
    extended.__mixinSet[mixin.__dedupeId] = true;
    return extended;
  }
};

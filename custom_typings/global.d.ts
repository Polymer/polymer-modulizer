
// Needed so that `ix` compiles cleanly.
declare interface EventTarget {
  addEventListener: (eventName: string, handler: EventListener, options?: boolean | EventListenerOptions) => void;
  removeEventListener: (eventName: string, handler: EventListener, options?: boolean | EventListenerOptions) => void;
}
declare interface EventListener {}
declare interface EventListenerOptions {
  capture?: boolean;
  passive?: boolean;
  once?: boolean;
}

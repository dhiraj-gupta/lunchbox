'use strict';

var event_handler = (function () {
  var handlers = [];

  return {
    bind: function (module, event, handler) {
      if (!handlers[module]) {
        handlers[module] = [];
      }

      if (!handlers[module][event]) {
        handlers[module][event] = [];
      }

      handlers[module][event].push(handler);
    },

    trigger: function (module, event, args) {
      if (!handlers[module] || !handlers[module][event]) {
        return;
      }

      handlers[module][event].forEach(function (handler) {
        handler.apply(handler, args);
      })
    }
  };
})();

module.exports.bind = event_handler.bind;
module.exports.trigger = event_handler.trigger;
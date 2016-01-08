'use strict';

var qc = load_mod('tools/qchain');
var fs = require('fs');

/**
 * Boot tasks.
 */
module.exports = (function () {
  return {
    setupNavigation: function (dialog) {
      var nav = load_mod('components/nav');
      nav.setContainer('#view-wrap');

      qc.add(function () {
        var deferred = qc.defer();

        var items = [];

        $('nav a').each(function (i, el) {
          el = $(el);
          items.push(el);

          if (el.attr('href') != '#') {
            nav.addNavItem(el, function (err) {
              if (err) {
                console.log('error: ' + err);
                return;
              }

              // remove 'active' class from all nav items
              items.forEach(function (item, i) {
                $(item).parent().removeClass('active');
              });

              // add 'active' class to clicked nav item
              el.parent().addClass('active');
            });
          }
        });

        deferred.resolve();
        
        return deferred.promise;
      });

      return qc.chain();
    }
  }
})();

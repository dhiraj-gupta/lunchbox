/**
 * Class definition for managing Dialog.
 */

// DVM Dialog class
(function(context) {
  "use strict";

  // add Dialog class to DVM scope
  if (!context.Dialog) {
    context.Dialog = (function(context) {
      // private
      
      // bootbox element is assigned to this var in create()
      var dialog = {};

      // default settings/configuration object
      var settings = {
        auto_scroll: false
      };

      /**
       * Returns HTML template for Dialog's content.
       * @return {[type]} [description]
       */
      function template() {
        var output = '';

        output += '<div class="progress">';
        output += '  <div class="progress-bar progress-bar-striped active"';
        output += '       role="progressbar"';
        output += '       aria-valuemin="0"';
        output += '       aria-valuemax="100"';
        output += '       aria-valuenow="0"';
        output += '       style="width: 0">';
        output += '    <span class="sr-only">100% Complete</span>';
        output += '  </div>';
        output += '</div>';

        output += 'Details';
        output += '<pre class="processingLog"></pre>';

        return output;
      }

      // public
      return {
        /**
         * Creates & returns new Dialog object.
         * 
         * @return {[type]} [description]
         */
        create: function(title, config) {
          if (typeof title == 'undefined') {
            title = '';
          }

          if (typeof config == 'undefined') {
            config = {};
          }

          this.setSettings(config);

          dialog = bootbox.dialog({
            title: title,
            message: template()
          });

          return this;
        },

        /**
         * Extends existing settings with config object.
         */
        setSettings: function (config) {
          settings = $.extend(settings, config);
        },

        /**
         * Updates the progressbar value.
         * @param {[type]} percentage [description]
         */
        setProgress: function (percentage) {
          if (typeof percentage != 'number' || percentage < 0 || percentage > 100) {
            return;
          }

          var bar = dialog.find('.progress-bar');
          bar.attr('aria-valuenow', percentage);
          bar.css('width', percentage + '%');
        },

        /**
         * Returns Bootbox Dialog.
         * 
         * @return {[type]}    [description]
         */
        get: function() {
          return dialog;
        },

        /**
         * Appends content to processingLog.
         * @param  {[type]} content [description]
         */
        append: function (content, type) {
          // support for data straight from Buffer
          if (content instanceof Buffer) {
            content = content.toString('utf8');
          }

          if (typeof type == 'undefined') {
            type = 'status';
          }

          switch (type) {
            case 'error':
              content = '<div class="error">' + content + '<div>';
              break;
            case 'warning':
              content = '<div class="warning">' + content + '<div>';
              break;
            case 'status':
            default:
          }

          var log = dialog.find('.processingLog');
          log.append(content);

          if (settings.auto_scroll) {
            log.scrollTop(log.get(0).scrollHeight);
          }
        },

        /**
         * Hides Dialog.
         */
        hide: function () {
          dialog.modal('hide');
        }
      };
    })(context);
  }
})(DVM);

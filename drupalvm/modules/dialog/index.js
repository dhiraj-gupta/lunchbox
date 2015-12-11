"use strict";

/**
 * Module for managing Bootbox dialogs.
 */
var dialog = (function() {
  // private
  
  // bootbox element is assigned to this var in create()
  var dialog = {};

  // default settings/configuration object
  var settings = {
    auto_scroll: true,
    hide_after_process: false
  };

  // child process for writing user input
  var child = {};

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

    output += '<input type="textfield" class="console-input" />';
    output += '<input type="submit" value="Submit" class="console-submit" />';

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

      // set up input processing
      dialog.find('input.console-submit').click(function () {
        if (!child) {
          return;
        }

        var input = dialog.find('input.console-input');
        var value = input.val();

        console.log('value is: ' + value);

        child.stdin.write(value);
        child.stdin.write('\n');

        var writer = child.stdin;

        writer.end('this is the end\n');
        writer.on('finish', function() {
          console.log('all writes are now complete.');
        });
        
        // clear input
        input.val('');
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
     * Writes buffer output to dialog's log.
     * 
     * @param  {[type]} process        [description]
     * @param  {[type]} outputCallback [description]
     * @return {[type]}                [description]
     */
    logProcess: function (process, outputCallback) {
      var self = this;

      var promise = new Promise(function (resolve, reject) {
        var write = function (buffer) {
          var content = buffer.toString('utf8');
          
          if (typeof outputCallback == 'function') {
            outputCallback(content);
          }

          self.append(content);
        };

        process.stdout.on('data', write);
        process.stderr.on('data', write);

        process.on('exit', function (exitCode) {
          if (settings.hide_after_process) {
            self.hide();
          }

          resolve();
        });
      });

      return promise;
    },

    /**
     * Sets child process.
     * 
     * @param {[type]} process [description]
     */
    setChildProcess: function (process) {
      child = process;
    },

    /**
     * Hides Dialog.
     */
    hide: function () {
      // dialog.modal('hide');
    }
  };
})();

module.exports = dialog;
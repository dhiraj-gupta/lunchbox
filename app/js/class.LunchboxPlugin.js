var os = require('os');

// constructor
var LunchboxPlugin = function (plugin, dialog) {
  this.plugin = plugin;
  this.dialog = dialog;
};

LunchboxPlugin.prototype.getUniqueName = function () {
  if (!this.unique_name) {
    this.unique_name = this.plugin.name + '-' + this.plugin.name_nice.toLowerCase().replace(/\W/g, '');
  }

  return this.unique_name;
};

LunchboxPlugin.prototype.getBootOps = function () {
  return {};
};

LunchboxPlugin.prototype.getNav = function () {
  return [];
};

LunchboxPlugin.prototype.log = function (message) {
  var log = '';

  if (this.plugin.name_nice) {
    log += this.plugin.name_nice + ': ';
  }
  else if (this.plugin.name) {
    log += this.plugin.name + ': ';
  }

  log += message + os.EOL;

  return log;
};

LunchboxPlugin.prototype.logDialog = function (message) {
  if (this.dialog) {
    this.dialog.append(this.log(message));
  }
};

window['LunchboxPlugin'] = LunchboxPlugin;
"use strict";

var remote = require('remote');
var app = remote.require('app');

var LunchboxSettings = function () {
  GenericSettings.call(this, app.getPath('userData') + '/settings.json');
};

LunchboxSettings.prototype = Object.create(GenericSettings.prototype);
LunchboxSettings.prototype.constructor = LunchboxSettings;

LunchboxSettings.prototype.load = function (callback) {
  var callback = callback || function () {};
  var self = this;

  this._storage.load(function (error, data) {
    if (error !== null) {
      callback(error, data);
      return;
    }

    if (data == null) {
      data = {};
    }

    if (typeof data.plugins == 'undefined') {
      data.plugins = [];
    }

    if (typeof data.views == 'undefined') {
      data.views = {
        dashboard: {},
        settings: {}
      };
    }

    self.rePopulate(data);

    callback(error, data);
  });
};

LunchboxSettings.prototype.save = function (callback) {
  var callback = callback || function () {};

  var properties = this.getOwnProperties();
  
  // the plugins stored in window.lunchbox.settings.plugins contains an
  // 'instance' property, which is an instantiated plugin object; that
  // object contains its own 'plugin' property, which is a reference to
  // the appropriate plugin in window.lunchbox.settings.plugins; this
  // circular inheritance will cause issues if we try to stringify the
  // object as-is; the workaround is to build a temporary plain settings 
  // object (just for JSON sting~ification purposes) that doesn't contain
  // functions or object instances
  var instances = [];
  for (var j in properties.plugins) {
    instances[j] = properties.plugins[j].instance;
    delete properties.plugins[j].instance;
  }

  this._storage.save(properties, function (error, returned_data) {
    if (error) {
      callback(error, returned_data);
      return;
    }

    // re-populate the temporarily removed 'instance' objects
    for (var k in returned_data.plugins) {
      returned_data.plugins[k].instance = instances[k];
    }

    callback(null, returned_data);
  });
};

window['LunchboxSettings'] = LunchboxSettings;
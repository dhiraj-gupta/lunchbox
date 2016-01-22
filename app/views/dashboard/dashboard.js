var settings = null;

$(document).ready(function () {
  settings = window.lunchbox.settings;

  var boot_log = $('#lunchbox-dashboard-boot-log');
  if (boot_log.length && typeof settings.views.dashboard.boot_log !== 'undefined') {
    boot_log.find('.panel-body').append(settings.views.dashboard.boot_log);
  }
});
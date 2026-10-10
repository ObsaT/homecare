// ignore: avoid_web_libraries_in_flutter
import 'dart:js' as js;

void playChime() {
  try {
    js.context.callMethod('playHomecareChime');
  } catch (_) {}
}

void playSiren() {
  try {
    js.context.callMethod('playHomecareSiren');
  } catch (_) {}
}

void requestNotificationPermission() {
  try {
    js.context.callMethod('requestHomecareNotificationPermission');
  } catch (_) {}
}

void showBrowserNotification(String title, String body) {
  try {
    js.context.callMethod('showHomecareWebNotification', [title, body]);
  } catch (_) {}
}

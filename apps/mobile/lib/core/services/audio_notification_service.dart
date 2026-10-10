import 'audio_notification_stub.dart'
    if (dart.library.html) 'audio_notification_web.dart' as platform;

class AudioNotificationService {
  /// Plays an audible dual-tone chime (A5 880Hz -> E6 1318.5Hz)
  static void playChime() {
    platform.playChime();
  }

  /// Plays an audible emergency SOS siren alarm
  static void playSosAlarm() {
    platform.playSiren();
  }

  /// Requests browser permission for native desktop/mobile push notifications
  static void requestNotificationPermission() {
    platform.requestNotificationPermission();
  }

  /// Triggers a browser native notification alert banner
  static void showNotification({required String title, required String body}) {
    platform.showBrowserNotification(title, body);
  }
}

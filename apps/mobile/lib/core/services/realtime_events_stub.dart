import 'dart:async';

typedef EventCallback = void Function(Map<String, dynamic> event);

class PlatformRealtimeClient {
  final StreamController<Map<String, dynamic>> _controller = StreamController<Map<String, dynamic>>.broadcast();

  Stream<Map<String, dynamic>> get stream => _controller.stream;

  void connect(String url, String? token) {
    // Stub for non-web / testing
  }

  void disconnect() {
    // Stub
  }

  void dispose() {
    _controller.close();
  }
}

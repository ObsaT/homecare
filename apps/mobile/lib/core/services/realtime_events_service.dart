import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../network/api_client.dart';
import 'realtime_events_stub.dart'
    if (dart.library.html) 'realtime_events_web.dart' as platform;

final realtimeEventsServiceProvider = Provider<RealtimeEventsService>((ref) {
  final api = ref.watch(apiClientProvider);
  final service = RealtimeEventsService(api);
  ref.onDispose(() => service.dispose());
  return service;
});

class RealtimeEventsService {
  final ApiClient _apiClient;
  final platform.PlatformRealtimeClient _client = platform.PlatformRealtimeClient();

  RealtimeEventsService(this._apiClient);

  Stream<Map<String, dynamic>> get stream => _client.stream;

  void connect() {
    final baseUrl = _apiClient.baseUrl;
    final token = _apiClient.token;
    _client.connect(baseUrl, token);
  }

  void disconnect() {
    _client.disconnect();
  }

  void dispose() {
    _client.dispose();
  }
}

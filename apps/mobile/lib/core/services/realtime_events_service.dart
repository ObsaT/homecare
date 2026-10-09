import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:web_socket_channel/web_socket_channel.dart';
import '../network/api_client.dart';

final realtimeEventsServiceProvider = Provider<RealtimeEventsService>((ref) {
  final api = ref.watch(apiClientProvider);
  final service = RealtimeEventsService(api);
  ref.onDispose(() => service.dispose());
  return service;
});

class RealtimeEventsService {
  final ApiClient _apiClient;
  final StreamController<Map<String, dynamic>> _controller =
      StreamController<Map<String, dynamic>>.broadcast();

  WebSocketChannel? _channel;
  StreamSubscription? _channelSub;
  Timer? _reconnectTimer;
  Timer? _pingTimer;
  bool _isDisposed = false;
  bool _shouldReconnect = false;
  bool _isConnected = false;

  RealtimeEventsService(this._apiClient);

  Stream<Map<String, dynamic>> get stream => _controller.stream;
  bool get isConnected => _isConnected;

  void connect() {
    _shouldReconnect = true;
    _connectInternal();
  }

  Future<void> _connectInternal() async {
    if (_isDisposed || !_shouldReconnect) return;

    disconnect(stopReconnect: false);

    try {
      if (_apiClient.token == null || _apiClient.token!.isEmpty) {
        await _apiClient.restoreToken();
      }
      final httpUrl = _apiClient.baseUrl;
      final token = _apiClient.token;
      final uri = Uri.parse(httpUrl);
      final wsScheme = uri.scheme == 'https' ? 'wss' : 'ws';

      final queryParams = <String, String>{};
      if (token != null && token.isNotEmpty) {
        queryParams['token'] = token;
      }

      final wsUri = Uri(
        scheme: wsScheme,
        host: uri.host,
        port: uri.hasPort ? uri.port : null,
        path: '/ws',
        queryParameters: queryParams.isNotEmpty ? queryParams : null,
      );

      debugPrint('Connecting WebSocket to: $wsUri');
      final channel = WebSocketChannel.connect(wsUri);
      _channel = channel;

      _channelSub = channel.stream.listen(
        (message) {
          _isConnected = true;
          try {
            if (message != null) {
              final decoded = jsonDecode(message.toString());
              if (decoded is Map<String, dynamic>) {
                _controller.add(decoded);
              }
            }
          } catch (e) {
            debugPrint('WebSocket message decode error: $e');
          }
        },
        onError: (error) {
          debugPrint('WebSocket connection error: $error');
          _isConnected = false;
          _scheduleReconnect();
        },
        onDone: () {
          debugPrint('WebSocket closed');
          _isConnected = false;
          _scheduleReconnect();
        },
        cancelOnError: false,
      );

      // Authenticate explicitly over frame if token exists
      if (token != null && token.isNotEmpty) {
        try {
          channel.sink.add(jsonEncode({'type': 'AUTH', 'token': token}));
        } catch (_) {}
      }

      _startPingTimer();
    } catch (e) {
      debugPrint('Failed to initialize WebSocket: $e');
      _scheduleReconnect();
    }
  }

  void _startPingTimer() {
    _pingTimer?.cancel();
    _pingTimer = Timer.periodic(const Duration(seconds: 20), (timer) {
      if (_channel != null && _isConnected) {
        try {
          _channel!.sink.add(jsonEncode({'type': 'PING'}));
        } catch (_) {}
      }
    });
  }

  void _scheduleReconnect() {
    _pingTimer?.cancel();
    if (_isDisposed || !_shouldReconnect) return;

    _reconnectTimer?.cancel();
    _reconnectTimer = Timer(const Duration(seconds: 4), () {
      if (!_isDisposed && _shouldReconnect) {
        _connectInternal();
      }
    });
  }

  void disconnect({bool stopReconnect = true}) {
    if (stopReconnect) {
      _shouldReconnect = false;
    }
    _isConnected = false;
    _pingTimer?.cancel();
    _reconnectTimer?.cancel();

    try {
      _channelSub?.cancel();
      _channelSub = null;
    } catch (_) {}

    try {
      _channel?.sink.close();
      _channel = null;
    } catch (_) {}
  }

  void dispose() {
    _isDisposed = true;
    _shouldReconnect = false;
    disconnect(stopReconnect: true);
    _controller.close();
  }
}

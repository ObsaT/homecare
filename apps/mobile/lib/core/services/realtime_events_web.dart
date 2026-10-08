// ignore: avoid_web_libraries_in_flutter
import 'dart:html' as html;
import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';

class PlatformRealtimeClient {
  final StreamController<Map<String, dynamic>> _controller = StreamController<Map<String, dynamic>>.broadcast();
  html.EventSource? _eventSource;

  Stream<Map<String, dynamic>> get stream => _controller.stream;

  void connect(String baseUrl, String? token) {
    disconnect();

    try {
      final uri = Uri.parse(baseUrl).replace(
        path: '${Uri.parse(baseUrl).path}/events/stream',
        queryParameters: token != null && token.isNotEmpty ? {'token': token} : null,
      );

      debugPrint('Connecting SSE to: $uri');
      final es = html.EventSource(uri.toString());
      _eventSource = es;

      es.onMessage.listen((html.MessageEvent event) {
        try {
          if (event.data != null && event.data.toString().isNotEmpty) {
            final decoded = jsonDecode(event.data.toString());
            if (decoded is Map<String, dynamic>) {
              _controller.add(decoded);
            }
          }
        } catch (e) {
          debugPrint('Error parsing SSE event: $e');
        }
      });

      es.onError.listen((html.Event error) {
        debugPrint('SSE connection state change / reconnecting...');
      });
    } catch (e) {
      debugPrint('Failed to open EventSource: $e');
    }
  }

  void disconnect() {
    try {
      _eventSource?.close();
    } catch (_) {}
    _eventSource = null;
  }

  void dispose() {
    disconnect();
    _controller.close();
  }
}

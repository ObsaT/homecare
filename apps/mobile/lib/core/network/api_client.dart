import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';

final apiClientProvider = Provider<ApiClient>((ref) => ApiClient());

class ApiClient {
  static const String productionApiUrl = 'https://homecare-api-67cm.onrender.com/api/v1';

  static String get defaultBaseUrl {
    const envUrl = String.fromEnvironment('API_URL');
    if (envUrl.isNotEmpty) {
      return envUrl;
    }
    if (kIsWeb) {
      final host = Uri.base.host.isNotEmpty ? Uri.base.host : 'localhost';
      if (host == 'localhost' || host == '127.0.0.1') {
        return 'http://$host:3000/api/v1';
      }
      return productionApiUrl;
    }
    return productionApiUrl;
  }

  final Dio dio;
  String? _authToken;

  ApiClient({String? baseUrl})
      : dio = Dio(
          BaseOptions(
            baseUrl: baseUrl ?? defaultBaseUrl,
            connectTimeout: const Duration(seconds: 10),
            receiveTimeout: const Duration(seconds: 15),
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
          ),
        ) {
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          if (_authToken != null && _authToken!.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $_authToken';
          }
          return handler.next(options);
        },
        onError: (DioException error, handler) {
          return handler.next(error);
        },
      ),
    );
    restoreToken();
  }

  String? get token => _authToken;
  String get baseUrl => dio.options.baseUrl;

  void setToken(String? token) {
    _authToken = token;
  }

  Future<void> restoreToken() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final saved = prefs.getString('hc_auth_token');
      if (saved != null && saved.isNotEmpty) {
        _authToken = saved;
      }
    } catch (_) {}
  }
}

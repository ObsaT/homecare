import 'package:flutter/foundation.dart';
import 'package:dio/dio.dart';

class ApiClient {
  static String get defaultBaseUrl {
    if (kIsWeb) {
      return 'http://localhost:3000/api/v1';
    }
    return 'http://10.0.2.2:3000/api/v1';
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
          if (_authToken != null) {
            options.headers['Authorization'] = 'Bearer $_authToken';
          }
          return handler.next(options);
        },
        onError: (DioException error, handler) {
          return handler.next(error);
        },
      ),
    );
  }

  void setToken(String? token) {
    _authToken = token;
  }
}

import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Singleton API client. Mirrors frontend/lib/api.ts in shape:
///   - Bearer token attached automatically from secure storage
///   - One-shot refresh on 401, single in-flight refresh shared across calls
///   - Cookies enabled so the same flow as the web also works on mobile
///
/// Endpoints are exposed as small typed helpers in api_endpoints.dart so the
/// rest of the app doesn't import dio directly.
class ApiClient {
  ApiClient._(this._dio);

  static final ApiClient instance = ApiClient._(_buildDio());

  final Dio _dio;
  static const _storage = FlutterSecureStorage();
  static const _tokenKey   = 'nirva.token';
  static const _refreshKey = 'nirva.refresh';

  static String get baseUrl =>
      const String.fromEnvironment('API_BASE_URL', defaultValue: 'http://localhost:3000/v1');

  static Dio _buildDio() {
    final dio = Dio(BaseOptions(
      baseUrl: baseUrl,
      connectTimeout: const Duration(seconds: 10),
      sendTimeout:    const Duration(seconds: 30),
      receiveTimeout: const Duration(seconds: 30),
      headers: {'Accept': 'application/json'},
    ));

    dio.interceptors.add(_AuthInterceptor(dio));
    return dio;
  }

  Dio get raw => _dio;

  Future<String?> getToken()   => _storage.read(key: _tokenKey);
  Future<String?> getRefresh() => _storage.read(key: _refreshKey);

  Future<void> setTokens({required String access, required String refresh}) async {
    await _storage.write(key: _tokenKey,   value: access);
    await _storage.write(key: _refreshKey, value: refresh);
  }

  Future<void> clearTokens() async {
    await _storage.delete(key: _tokenKey);
    await _storage.delete(key: _refreshKey);
  }
}

class _AuthInterceptor extends Interceptor {
  _AuthInterceptor(this._dio);
  final Dio _dio;

  // Single in-flight refresh shared across concurrent failed requests.
  Future<String?>? _refreshing;

  @override
  Future<void> onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    if (!options.path.startsWith('/auth/')) {
      final token = await ApiClient.instance.getToken();
      if (token != null) options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }

  @override
  Future<void> onError(DioException err, ErrorInterceptorHandler handler) async {
    final res = err.response;
    final isAuthCall = err.requestOptions.path.startsWith('/auth/');
    if (res?.statusCode != 401 || isAuthCall || err.requestOptions.extra['retried'] == true) {
      return handler.next(err);
    }

    final newToken = await (_refreshing ??= _doRefresh());
    _refreshing = null;
    if (newToken == null) return handler.next(err);

    // Replay the failed request once with the new token.
    final retry = err.requestOptions
      ..headers['Authorization'] = 'Bearer $newToken'
      ..extra['retried'] = true;
    try {
      final replayed = await _dio.fetch(retry);
      handler.resolve(replayed);
    } catch (replayErr) {
      handler.reject(replayErr is DioException ? replayErr : err);
    }
  }

  Future<String?> _doRefresh() async {
    final refresh = await ApiClient.instance.getRefresh();
    if (refresh == null) return null;
    try {
      final res = await _dio.post('/auth/refresh', data: {'refresh_token': refresh});
      final access  = res.data['token']         as String;
      final newRef  = res.data['refresh_token'] as String;
      await ApiClient.instance.setTokens(access: access, refresh: newRef);
      return access;
    } catch (_) {
      await ApiClient.instance.clearTokens();
      return null;
    }
  }
}

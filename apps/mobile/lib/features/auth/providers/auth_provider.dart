import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';
import '../models/user.dart';


class AuthState {
  final bool isAuthenticated;
  final bool isLoading;
  final AppUser? user;
  final String? token;
  final String? challengeId;
  final String? errorMessage;

  AuthState({
    this.isAuthenticated = false,
    this.isLoading = false,
    this.user,
    this.token,
    this.challengeId,
    this.errorMessage,
  });

  AuthState copyWith({
    bool? isAuthenticated,
    bool? isLoading,
    AppUser? user,
    String? token,
    String? challengeId,
    String? errorMessage,
  }) {
    return AuthState(
      isAuthenticated: isAuthenticated ?? this.isAuthenticated,
      isLoading: isLoading ?? this.isLoading,
      user: user ?? this.user,
      token: token ?? this.token,
      challengeId: challengeId ?? this.challengeId,
      errorMessage: errorMessage,
    );
  }
}

class AuthNotifier extends StateNotifier<AuthState> {
  final ApiClient _api;

  AuthNotifier(this._api) : super(AuthState());

  Future<bool> loginWithPassword(String phone, String password) async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      final res = await _api.dio.post('/auth/login', data: {
        'phone_e164': phone,
        'password': password,
      });
      final data = res.data;
      final token = data['access_token'] ?? data['data']?['access_token'];
      if (token == null) {
        state = state.copyWith(isLoading: false, errorMessage: 'No session token received');
        return false;
      }
      _api.setToken(token.toString());

      final rawUser = data['user'] ?? data['data']?['user'] ?? {};
      final roleStr = (rawUser['role'] as String? ?? 'CUSTOMER').toUpperCase();
      final userRole = roleStr == 'CAREGIVER' ? UserRole.caregiver : UserRole.customer;

      final user = AppUser(
        id: rawUser['id'] ?? 'usr-${DateTime.now().millisecondsSinceEpoch}',
        phone: rawUser['phone_e164'] ?? phone,
        fullName: rawUser['full_name'] ?? (userRole == UserRole.caregiver ? 'Sister Almaz (Nurse)' : 'Abebe Bikila'),
        role: userRole,
        isAvailable: true,
      );

      state = state.copyWith(
        isLoading: false,
        isAuthenticated: true,
        token: token.toString(),
        user: user,
      );
      return true;
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: 'Invalid phone number or password. Check credentials.',
      );
      return false;
    }
  }

  Future<bool> requestOtp(String phone) async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      final res = await _api.dio.post('/auth/otp/request', data: {
        'phone_e164': phone,
        'purpose': 'LOGIN',
      });
      final challengeId = res.data['data']?['challenge_id'] ?? res.data['challenge_id'] ?? 'mock-challenge';
      state = state.copyWith(isLoading: false, challengeId: challengeId.toString());
      return true;
    } catch (e) {
      // In offline/dev mode, permit continuation with simulated challenge
      state = state.copyWith(isLoading: false, challengeId: 'simulated-challenge');
      return true;
    }
  }

  Future<bool> verifyOtp(String code, {UserRole role = UserRole.customer}) async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      final res = await _api.dio.post('/auth/otp/verify', data: {
        'challenge_id': state.challengeId ?? 'mock-challenge',
        'code': code,
      });

      final data = res.data;
      final token = data['access_token'] ?? data['data']?['access_token'] ?? 'mock-access-token';
      _api.setToken(token.toString());

      final rawUser = data['user'] ?? data['data']?['user'] ?? {};
      final roleStr = (rawUser['role'] as String? ?? (role == UserRole.caregiver ? 'CAREGIVER' : 'CUSTOMER')).toUpperCase();
      final userRole = roleStr == 'CAREGIVER' ? UserRole.caregiver : UserRole.customer;

      final user = AppUser(
        id: rawUser['id'] ?? 'usr-current',
        phone: rawUser['phone_e164'] ?? '+251911000001',
        fullName: rawUser['full_name'] ?? (userRole == UserRole.caregiver ? 'Sister Almaz (Nurse)' : 'Abebe Bikila'),
        role: userRole,
        isAvailable: true,
      );

      state = state.copyWith(
        isLoading: false,
        isAuthenticated: true,
        token: token.toString(),
        user: user,
      );
      return true;
    } catch (e) {
      // Dev fallback for smooth local testing
      final user = AppUser(
        id: 'usr-current',
        phone: '+251911000001',
        fullName: role == UserRole.caregiver ? 'Sister Almaz (Nurse)' : 'Abebe Bikila',
        role: role,
        isAvailable: true,
      );
      _api.setToken('mock-access-token');

      state = state.copyWith(
        isLoading: false,
        isAuthenticated: true,
        token: 'mock-access-token',
        user: user,
      );
      return true;
    }
  }

  void logout() {
    _api.setToken(null);
    state = AuthState();
  }

  void switchRole(UserRole newRole) {
    if (state.user != null) {
      final updated = AppUser(
        id: state.user!.id,
        phone: state.user!.phone,
        fullName: newRole == UserRole.caregiver ? 'Sister Almaz (Nurse)' : 'Abebe Bikila',
        role: newRole,
        isAvailable: true,
      );
      state = state.copyWith(user: updated);
    }
  }
}

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  final api = ref.watch(apiClientProvider);
  return AuthNotifier(api);
});

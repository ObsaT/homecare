import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
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

  AuthNotifier(this._api) : super(AuthState()) {
    restoreSession();
  }

  Future<void> restoreSession() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('hc_auth_token');
      final userId = prefs.getString('hc_user_id');
      final userPhone = prefs.getString('hc_user_phone');
      final userName = prefs.getString('hc_user_name');
      final userRoleStr = prefs.getString('hc_user_role');

      if (token != null && token.isNotEmpty && userId != null) {
        _api.setToken(token);
        final role = userRoleStr == 'CAREGIVER' ? UserRole.caregiver : UserRole.customer;
        final user = AppUser(
          id: userId,
          phone: userPhone ?? '+251911555555',
          fullName: userName ?? 'Abebe Bikila',
          role: role,
          isAvailable: true,
        );
        state = state.copyWith(
          isAuthenticated: true,
          token: token,
          user: user,
        );
      }
    } catch (_) {}
  }

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
        state = state.copyWith(isLoading: false, errorMessage: 'No session token received from server');
        return false;
      }
      _api.setToken(token.toString());

      final rawUser = data['user'] ?? data['data']?['user'] ?? {};
      final roleStr = (rawUser['role'] as String? ?? 'CUSTOMER').toUpperCase();
      final userRole = roleStr == 'CAREGIVER' ? UserRole.caregiver : UserRole.customer;

      final user = AppUser(
        id: rawUser['id'] ?? 'usr-${DateTime.now().millisecondsSinceEpoch}',
        phone: rawUser['phone_e164'] ?? phone,
        fullName: rawUser['full_name'] ?? (userRole == UserRole.caregiver ? 'Sister Almaz Hailu (RN)' : 'Abebe Bikila'),
        role: userRole,
        isAvailable: true,
      );

      try {
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('hc_auth_token', token.toString());
        await prefs.setString('hc_user_id', user.id);
        await prefs.setString('hc_user_phone', user.phone);
        await prefs.setString('hc_user_name', user.fullName);
        await prefs.setString('hc_user_role', userRole == UserRole.caregiver ? 'CAREGIVER' : 'CUSTOMER');
      } catch (_) {}

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
        errorMessage: 'Invalid phone or password. Use demo account or tap 1-tap sign in.',
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
      final challengeId = res.data['data']?['challenge_id'] ?? res.data['challenge_id'] ?? 'simulated-challenge';
      state = state.copyWith(isLoading: false, challengeId: challengeId.toString());
      return true;
    } catch (e) {
      state = state.copyWith(isLoading: false, challengeId: 'simulated-challenge');
      return true;
    }
  }

  Future<bool> verifyOtp(String code, {UserRole role = UserRole.customer}) async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      final res = await _api.dio.post('/auth/otp/verify', data: {
        'challenge_id': state.challengeId ?? 'simulated-challenge',
        'code': code,
      });

      final data = res.data;
      final token = data['access_token'] ?? data['data']?['access_token'];
      if (token != null) {
        _api.setToken(token.toString());
        final rawUser = data['user'] ?? data['data']?['user'] ?? {};
        final roleStr = (rawUser['role'] as String? ?? (role == UserRole.caregiver ? 'CAREGIVER' : 'CUSTOMER')).toUpperCase();
        final userRole = roleStr == 'CAREGIVER' ? UserRole.caregiver : UserRole.customer;

        final user = AppUser(
          id: rawUser['id'] ?? 'usr-current',
          phone: rawUser['phone_e164'] ?? '+251911555555',
          fullName: rawUser['full_name'] ?? (userRole == UserRole.caregiver ? 'Sister Almaz (Nurse)' : 'Abebe Bikila'),
          role: userRole,
          isAvailable: true,
        );

        try {
          final prefs = await SharedPreferences.getInstance();
          await prefs.setString('hc_auth_token', token.toString());
          await prefs.setString('hc_user_id', user.id);
          await prefs.setString('hc_user_phone', user.phone);
          await prefs.setString('hc_user_name', user.fullName);
          await prefs.setString('hc_user_role', userRole == UserRole.caregiver ? 'CAREGIVER' : 'CUSTOMER');
        } catch (_) {}

        state = state.copyWith(
          isLoading: false,
          isAuthenticated: true,
          token: token.toString(),
          user: user,
        );
        return true;
      }

      state = state.copyWith(
        isLoading: false,
        errorMessage: 'Invalid verification code. Please sign in with your account password.',
      );
      return false;
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: 'Verification failed. Use password login or 1-tap sign-in.',
      );
      return false;
    }
  }

  Future<void> logout() async {
    _api.setToken(null);
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove('hc_auth_token');
      await prefs.remove('hc_user_id');
      await prefs.remove('hc_user_phone');
      await prefs.remove('hc_user_name');
      await prefs.remove('hc_user_role');
    } catch (_) {}
    state = AuthState();
  }

  void switchRole(UserRole newRole) {
    if (state.user != null) {
      final updated = AppUser(
        id: state.user!.id,
        phone: state.user!.phone,
        fullName: newRole == UserRole.caregiver ? 'Sister Almaz Hailu (RN)' : 'Abebe Bikila',
        role: newRole,
        isAvailable: true,
      );
      state = state.copyWith(user: updated);
    }
  }

  Future<Map<String, dynamic>> getRegistrationFee() async {
    try {
      final res = await _api.dio.get('/pricing/registration-fee');
      final data = res.data['data'] ?? res.data;
      return {
        'fee_etb': (data['fee_etb'] as num?)?.toDouble() ?? 500.0,
        'currency': data['currency'] ?? 'ETB',
        'description': data['description'] ?? 'Standard Caregiver Clinical Onboarding & Telebirr Verification Fee',
      };
    } catch (_) {
      return {
        'fee_etb': 500.0,
        'currency': 'ETB',
        'description': 'Standard Caregiver Clinical Onboarding & Telebirr Verification Fee',
      };
    }
  }

  Future<bool> registerCustomer({
    required String fullName,
    required String phone,
    required String password,
    required String subCity,
    String? woreda,
    String? houseNumber,
    String? landmark,
    String? emergencyName,
    String? emergencyPhone,
    String? emergencyRel,
  }) async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      final phoneDigits = phone.trim().replaceFirst(RegExp(r'^0'), '').replaceAll(RegExp(r'^\+251'), '');
      final phoneNormalized = '+251$phoneDigits';

      final res = await _api.dio.post('/auth/register/customer', data: {
        'full_name': fullName.trim(),
        'phone_e164': phoneNormalized,
        'password': password.trim(),
        'sub_city_name': subCity,
        'woreda': woreda?.trim() ?? '01',
        'house_number': houseNumber?.trim() ?? 'House 101',
        'landmark': landmark?.trim() ?? '',
        'emergency_contact_name': emergencyName?.trim() ?? 'Family Contact',
        'emergency_contact_phone': emergencyPhone?.trim() ?? phoneNormalized,
        'emergency_contact_relationship': emergencyRel?.trim() ?? 'Family',
      });

      final data = res.data;
      final token = data['access_token'] ?? data['data']?['access_token'];
      if (token == null) {
        state = state.copyWith(isLoading: false, errorMessage: 'Registration succeeded but no token returned');
        return false;
      }
      _api.setToken(token.toString());

      final rawUser = data['user'] ?? data['data']?['user'] ?? {};
      final user = AppUser(
        id: rawUser['id'] ?? 'usr-${DateTime.now().millisecondsSinceEpoch}',
        phone: rawUser['phone_e164'] ?? phoneNormalized,
        fullName: rawUser['full_name'] ?? fullName,
        role: UserRole.customer,
        isAvailable: true,
      );

      try {
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('hc_auth_token', token.toString());
        await prefs.setString('hc_user_id', user.id);
        await prefs.setString('hc_user_phone', user.phone);
        await prefs.setString('hc_user_name', user.fullName);
        await prefs.setString('hc_user_role', 'CUSTOMER');
      } catch (_) {}

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
        errorMessage: 'Registration failed. Phone may already be registered or network issue.',
      );
      return false;
    }
  }

  Future<bool> registerCaregiver({
    required String fullName,
    required String phone,
    required String password,
    required String professionalTitle,
    required String qualificationLevel,
    String? licenceNumber,
    int? yearsExperience,
    required String subCity,
    required String telebirrPhone,
    required String telebirrReference,
  }) async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      final phoneDigits = phone.trim().replaceFirst(RegExp(r'^0'), '').replaceAll(RegExp(r'^\+251'), '');
      final phoneNormalized = '+251$phoneDigits';

      final res = await _api.dio.post('/auth/register/caregiver', data: {
        'full_name': fullName.trim(),
        'phone_e164': phoneNormalized,
        'password': password.trim(),
        'professional_title': professionalTitle.trim(),
        'qualification_level': qualificationLevel.trim(),
        'licence_number': licenceNumber?.trim() ?? 'MOH/PENDING',
        'years_experience': yearsExperience ?? 2,
        'home_sub_city_name': subCity,
        'payment_method': 'TELEBIRR',
        'telebirr_phone': telebirrPhone.trim(),
        'telebirr_reference': telebirrReference.trim(),
        'confirm_sample_payment': true,
      });

      final data = res.data;
      final token = data['access_token'] ?? data['data']?['access_token'];
      if (token == null) {
        state = state.copyWith(isLoading: false, errorMessage: 'Caregiver registration succeeded but no token returned');
        return false;
      }
      _api.setToken(token.toString());

      final rawUser = data['user'] ?? data['data']?['user'] ?? {};
      final user = AppUser(
        id: rawUser['id'] ?? 'usr-${DateTime.now().millisecondsSinceEpoch}',
        phone: rawUser['phone_e164'] ?? phoneNormalized,
        fullName: rawUser['full_name'] ?? fullName,
        role: UserRole.caregiver,
        isAvailable: true,
      );

      try {
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('hc_auth_token', token.toString());
        await prefs.setString('hc_user_id', user.id);
        await prefs.setString('hc_user_phone', user.phone);
        await prefs.setString('hc_user_name', user.fullName);
        await prefs.setString('hc_user_role', 'CAREGIVER');
      } catch (_) {}

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
        errorMessage: 'Caregiver registration failed. Phone may already be registered or network error.',
      );
      return false;
    }
  }
}


final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  final api = ref.watch(apiClientProvider);
  return AuthNotifier(api);
});

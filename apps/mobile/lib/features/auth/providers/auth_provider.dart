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

  static String normalizePhoneE164(String raw) {
    final digitsOnly = raw.replaceAll(RegExp(r'\D'), '');
    if (digitsOnly.isEmpty) return '';
    String subscriber = digitsOnly;
    if (subscriber.startsWith('251') && subscriber.length >= 12) {
      subscriber = subscriber.substring(3);
    }
    while (subscriber.startsWith('0') && subscriber.length > 9) {
      subscriber = subscriber.substring(1);
    }
    if (subscriber.startsWith('0') && subscriber.length == 10) {
      subscriber = subscriber.substring(1);
    }
    return '+251$subscriber';
  }

  static String _extractErrorMessage(Object e, String fallback) {
    try {
      final dynamic errObj = e;
      final respData = errObj.response?.data;
      if (respData is Map) {
        final nestedMsg = respData['error'] is Map ? respData['error']['message']?.toString() : null;
        if (nestedMsg != null && nestedMsg.isNotEmpty) return nestedMsg;
        final topMsg = respData['message']?.toString();
        if (topMsg != null && topMsg.isNotEmpty) return topMsg;
      }
      final status = errObj.response?.statusCode;
      if (status == 409) {
        return 'This phone number is already registered. Please sign in or use a different phone number.';
      }
    } catch (_) {}
    return fallback;
  }

  Future<void> restoreSession() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('hc_auth_token');
      final userId = prefs.getString('hc_user_id');
      final userPhone = prefs.getString('hc_user_phone');
      final userName = prefs.getString('hc_user_name');
      final userRoleStr = prefs.getString('hc_user_role');

      if (token != null && token.isNotEmpty && userId != null && userName != null && userName.isNotEmpty) {
        _api.setToken(token);
        final role = userRoleStr == 'CAREGIVER' ? UserRole.caregiver : UserRole.customer;
        final user = AppUser(
          id: userId,
          phone: userPhone ?? '',
          fullName: userName,
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

  Future<Map<String, dynamic>> checkPhoneAvailability(String phone, {String? licenceNumber}) async {
    final normalized = normalizePhoneE164(phone);
    final subscriber = normalized.replaceFirst(RegExp(r'^\+251'), '');
    if (normalized.isEmpty || subscriber.length != 9 || !RegExp(r'^[79]\d{8}$').hasMatch(subscriber)) {
      return {
        'available': false,
        'phone_e164': normalized,
        'message': 'Please enter a valid 9-digit Ethiopian mobile number (e.g. 09XXXXXXXX or 07XXXXXXXX).',
      };
    }

    try {
      final res = await _api.dio.post('/auth/check-phone', data: {
        'phone_e164': normalized,
        if (licenceNumber != null && licenceNumber.trim().isNotEmpty)
          'licence_number': licenceNumber.trim(),
      });
      final data = res.data is Map && res.data['data'] != null ? res.data['data'] : res.data;
      if (data is Map) {
        return {
          'available': data['available'] == true,
          'phone_e164': data['phone_e164']?.toString() ?? normalized,
          'message': data['message']?.toString(),
        };
      }
    } catch (e) {
      try {
        final dynamic errObj = e;
        if (errObj.response?.statusCode == 404) {
          return {
            'available': true,
            'phone_e164': normalized,
          };
        }
      } catch (_) {}
      final msg = _extractErrorMessage(
        e,
        'Unable to verify phone number availability. Please check your connection.',
      );
      return {
        'available': false,
        'phone_e164': normalized,
        'message': msg,
      };
    }

    return {
      'available': true,
      'phone_e164': normalized,
    };
  }

  Future<bool> loginWithPassword(String phone, String password) async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      final phoneNormalized = normalizePhoneE164(phone);
      final res = await _api.dio.post('/auth/login', data: {
        'phone_e164': phoneNormalized,
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
        id: rawUser['id']?.toString() ?? 'usr-${DateTime.now().millisecondsSinceEpoch}',
        phone: rawUser['phone_e164']?.toString() ?? phoneNormalized,
        fullName: rawUser['full_name']?.toString() ?? 'User',
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
        errorMessage: _extractErrorMessage(
          e,
          'Invalid phone number or password. Please check your credentials or register a new account.',
        ),
      );
      return false;
    }
  }

  Future<bool> requestOtp(String phone) async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      final phoneNormalized = normalizePhoneE164(phone);
      final res = await _api.dio.post('/auth/otp/request', data: {
        'phone_e164': phoneNormalized,
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
          id: rawUser['id']?.toString() ?? 'usr-current',
          phone: rawUser['phone_e164']?.toString() ?? '',
          fullName: rawUser['full_name']?.toString() ?? 'User',
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
        errorMessage: 'Verification failed. Please sign in with your account password.',
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
    final currentUser = state.user;
    if (currentUser != null) {
      final updated = AppUser(
        id: currentUser.id,
        phone: currentUser.phone,
        fullName: currentUser.fullName,
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

  Future<Map<String, dynamic>> createTelebirrSandboxOrder({
    required double amountEtb,
    required String phone,
    String purpose = 'CAREGIVER_REGISTRATION',
    String? invoiceId,
    String? requestId,
    String? title,
  }) async {
    try {
      final res = await _api.dio.post('/payments/telebirr/create-order', data: {
        'amount_etb': amountEtb,
        'phone_e164': normalizePhoneE164(phone),
        'purpose': purpose,
        if (invoiceId != null) 'invoice_id': invoiceId,
        if (requestId != null) 'request_id': requestId,
        if (title != null) 'title': title,
      });
      final data = res.data is Map && res.data['data'] != null ? res.data['data'] : res.data;
      return Map<String, dynamic>.from(data as Map);
    } catch (_) {
      final ts = DateTime.now().millisecondsSinceEpoch.toString().substring(5);
      return {
        'prepay_id': 'PREPAY-TB-$ts',
        'merch_order_id': 'HC-ORD-$ts',
        'short_code': '884210',
        'merchant_name': 'Pillar Home Care Health Network',
        'amount_etb': amountEtb,
        'amount_santim': (amountEtb * 100).round(),
        'sandbox_mode': true,
        'ussd_prompt': 'USSD Push (*127#) to $phone: Confirm payment of ETB ${amountEtb.toStringAsFixed(2)} to Pillar Home Care (884210).',
      };
    }
  }

  Future<Map<String, dynamic>> authorizeTelebirrSandboxOrder({
    String? prepayId,
    String? merchOrderId,
    required String telebirrPhone,
    required String pin,
    required double amountEtb,
    String purpose = 'CAREGIVER_REGISTRATION',
    String? invoiceId,
    String? requestId,
  }) async {
    final res = await _api.dio.post('/payments/telebirr/authorize', data: {
      if (prepayId != null) 'prepay_id': prepayId,
      if (merchOrderId != null) 'merch_order_id': merchOrderId,
      'telebirr_phone': normalizePhoneE164(telebirrPhone),
      'pin': pin,
      'amount_etb': amountEtb,
      'purpose': purpose,
      if (invoiceId != null) 'invoice_id': invoiceId,
      if (requestId != null) 'request_id': requestId,
    });
    final data = res.data is Map && res.data['data'] != null ? res.data['data'] : res.data;
    return Map<String, dynamic>.from(data as Map);
  }

  Future<bool> registerCustomer({
    required String fullName,
    required String phone,
    required String password,
    required String subCity,
    String? woreda,
    String? houseNumber,
    String? landmark,
    double? latitude,
    double? longitude,
    String? emergencyName,
    String? emergencyPhone,
    String? emergencyRel,
    String preferredLanguage = 'en',
    bool deferAuthTransition = false,
  }) async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      final phoneNormalized = normalizePhoneE164(phone);
      final availability = await checkPhoneAvailability(phoneNormalized);
      if (availability['available'] != true) {
        state = state.copyWith(
          isLoading: false,
          errorMessage: availability['message']?.toString() ??
              'This phone number is already registered. Please sign in or use a different phone number.',
        );
        return false;
      }

      final emPhoneRaw = emergencyPhone?.trim() ?? '';
      final emPhoneNormalized = emPhoneRaw.isNotEmpty ? normalizePhoneE164(emPhoneRaw) : phoneNormalized;

      final res = await _api.dio.post('/auth/register/customer', data: {
        'full_name': fullName.trim(),
        'phone_e164': phoneNormalized,
        'password': password.trim(),
        'sub_city_name': subCity,
        'woreda': (woreda != null && woreda.trim().isNotEmpty) ? woreda.trim() : '01',
        'house_number': (houseNumber != null && houseNumber.trim().isNotEmpty) ? houseNumber.trim() : '',
        'landmark': landmark?.trim() ?? '',
        if (latitude != null) 'latitude': latitude,
        if (longitude != null) 'longitude': longitude,
        'emergency_contact_name': (emergencyName != null && emergencyName.trim().isNotEmpty) ? emergencyName.trim() : fullName.trim(),
        'emergency_contact_phone': emPhoneNormalized,
        'emergency_contact_relationship': (emergencyRel != null && emergencyRel.trim().isNotEmpty) ? emergencyRel.trim() : 'Family',
        'preferred_language': preferredLanguage,
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
        id: rawUser['id']?.toString() ?? 'usr-${DateTime.now().millisecondsSinceEpoch}',
        phone: rawUser['phone_e164']?.toString() ?? phoneNormalized,
        fullName: rawUser['full_name']?.toString() ?? fullName.trim(),
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
        await prefs.setString('hc_customer_sub_city', subCity);
        if (landmark != null && landmark.trim().isNotEmpty) {
          await prefs.setString('hc_customer_landmark', landmark.trim());
        }
        if (latitude != null && longitude != null) {
          await prefs.setDouble('hc_customer_lat', latitude);
          await prefs.setDouble('hc_customer_lng', longitude);
        }
      } catch (_) {}

      state = state.copyWith(
        isLoading: false,
        isAuthenticated: !deferAuthTransition,
        token: token.toString(),
        user: user,
      );
      return true;
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: _extractErrorMessage(
          e,
          'Registration failed. This phone number may already be registered.',
        ),
      );
      return false;
    }
  }

  void completeDeferredAuthTransition() {
    if (state.user != null && state.token != null && !state.isAuthenticated) {
      state = state.copyWith(isAuthenticated: true, isLoading: false);
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
    String preferredLanguage = 'en',
    bool deferAuthTransition = false,
  }) async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      final phoneNormalized = normalizePhoneE164(phone);
      final tbPhoneNormalized = normalizePhoneE164(telebirrPhone);

      final res = await _api.dio.post('/auth/register/caregiver', data: {
        'full_name': fullName.trim(),
        'phone_e164': phoneNormalized,
        'password': password.trim(),
        'professional_title': professionalTitle.trim(),
        'qualification_level': qualificationLevel.trim(),
        'licence_number': (licenceNumber != null && licenceNumber.trim().isNotEmpty)
            ? licenceNumber.trim()
            : 'MOH/PENDING',
        'years_experience': yearsExperience ?? 1,
        'home_sub_city_name': subCity,
        'payment_method': 'TELEBIRR',
        'telebirr_phone': tbPhoneNormalized.isNotEmpty ? tbPhoneNormalized : phoneNormalized,
        'telebirr_reference': telebirrReference.trim(),
        'confirm_sample_payment': true,
        'preferred_language': preferredLanguage,
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
        id: rawUser['id']?.toString() ?? 'usr-${DateTime.now().millisecondsSinceEpoch}',
        phone: rawUser['phone_e164']?.toString() ?? phoneNormalized,
        fullName: rawUser['full_name']?.toString() ?? fullName.trim(),
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
        isAuthenticated: !deferAuthTransition,
        token: token.toString(),
        user: user,
      );
      return true;
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: _extractErrorMessage(
          e,
          'Caregiver registration failed. Phone number may already be registered.',
        ),
      );
      return false;
    }
  }
}

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  final api = ref.watch(apiClientProvider);
  return AuthNotifier(api);
});

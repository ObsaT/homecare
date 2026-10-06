import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/theme/app_theme.dart';
import 'features/auth/models/user.dart';
import 'features/auth/presentation/login_screen.dart';
import 'features/auth/providers/auth_provider.dart';
import 'features/caregiver/presentation/caregiver_home_screen.dart';
import 'features/customer/presentation/customer_home_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(
    const ProviderScope(
      child: HomeCareApp(),
    ),
  );
}

class HomeCareApp extends ConsumerWidget {
  const HomeCareApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authProvider);

    return MaterialApp(
      title: 'Home Care Addis',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      home: _buildHome(authState),
    );
  }

  Widget _buildHome(AuthState authState) {
    if (!authState.isAuthenticated || authState.user == null) {
      return const LoginScreen();
    }

    switch (authState.user!.role) {
      case UserRole.caregiver:
        return const CaregiverHomeScreen();
      case UserRole.customer:
      default:
        return const CustomerHomeScreen();
    }
  }
}

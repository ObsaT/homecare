import 'package:flutter/material.dart';

class AppColors {
  // Brand colors mirroring @homecare/design-tokens
  static const Color primary = Color(0xFF0F6B5C);
  static const Color primaryHover = Color(0xFF0B5749);
  static const Color primaryPressed = Color(0xFF084338);
  static const Color onPrimary = Colors.white;
  static const Color accent = Color(0xFFC2703B);

  // Surfaces
  static const Color surfacePage = Color(0xFFFFFFFF);
  static const Color surfacePageMuted = Color(0xFFF7F8F7);
  static const Color surfaceSunken = Color(0xFFF1F3F2);

  // Text
  static const Color textPrimary = Color(0xFF151A19);
  static const Color textSecondary = Color(0xFF5A6360);
  static const Color textTertiary = Color(0xFF8A928F);

  // Borders
  static const Color borderSubtle = Color(0xFFE6E9E8);
  static const Color borderStrong = Color(0xFFC9CFCD);

  // Statuses
  static const Color statusPending = Color(0xFFB4791F);
  static const Color statusConfirmed = Color(0xFF0F6B5C);
  static const Color statusInProgress = Color(0xFF0F6B5C);
  static const Color statusCompleted = Color(0xFF4A7C59);
  static const Color statusCancelled = Color(0xFF8C2F2F);
  static const Color statusOffered = Color(0xFF1F6FB2);

  // Common UI Aliases
  static const Color primaryLight = Color(0xFFE6F3F0);
  static const Color secondary = Color(0xFFC2703B);
  static const Color accentWarning = Color(0xFFB4791F);
  static const Color success = Color(0xFF4A7C59);
  static const Color error = Color(0xFF8C2F2F);
  static const Color errorLight = Color(0xFFFDE8E8);
  static const Color surface = Color(0xFFFFFFFF);
  static const Color border = Color(0xFFE6E9E8);
}

class AppTheme {
  static ThemeData get lightTheme {
    return ThemeData(
      useMaterial3: true,
      scaffoldBackgroundColor: AppColors.surfacePageMuted,
      colorScheme: ColorScheme.fromSeed(
        seedColor: AppColors.primary,
        primary: AppColors.primary,
        secondary: AppColors.accent,
        surface: AppColors.surfacePage,
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: Colors.white,
        foregroundColor: AppColors.textPrimary,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: TextStyle(
          color: AppColors.textPrimary,
          fontSize: 18,
          fontWeight: FontWeight.bold,
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.primary,
          foregroundColor: Colors.white,
          minimumSize: const Size.fromHeight(48),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          textStyle: const TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.borderSubtle),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.borderSubtle),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
        ),
      ),
      cardTheme: CardThemeData(
        color: Colors.white,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: AppColors.borderSubtle),
        ),
      ),
    );
  }
}

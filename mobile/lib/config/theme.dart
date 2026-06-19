import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'colors.dart';

class AppTheme {
  AppTheme._();

  static ThemeData get light => ThemeData(
    brightness: Brightness.light,
    scaffoldBackgroundColor: AppColors.background,
    colorScheme: const ColorScheme.light(
      primary: AppColors.primary,
      secondary: AppColors.accent,
      surface: AppColors.surface,
      error: AppColors.error,
      onPrimary: Colors.white,
      onSecondary: Colors.white,
      onSurface: AppColors.textPrimary,
      onError: Colors.white,
    ),
    textTheme: _buildTextTheme(AppColors.textPrimary, AppColors.textSecondary),
    appBarTheme: const AppBarTheme(
      backgroundColor: AppColors.surface,
      elevation: 0,
      scrolledUnderElevation: 1,
      shadowColor: AppColors.border,
      foregroundColor: AppColors.textPrimary,
      titleTextStyle: TextStyle(
        fontFamily: 'SpaceGrotesk',
        fontSize: 18,
        fontWeight: FontWeight.w700,
        color: AppColors.textPrimary,
      ),
    ),
    cardTheme: CardThemeData(
      color: AppColors.surface,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: const BorderSide(color: AppColors.border),
      ),
      margin: EdgeInsets.zero,
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: AppColors.surface,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.border, width: 1.5),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.border, width: 1.5),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.error, width: 1.5),
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      labelStyle: const TextStyle(color: AppColors.textSecondary),
      hintStyle: const TextStyle(color: AppColors.textMuted),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        elevation: 0,
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        textStyle: GoogleFonts.plusJakartaSans(fontSize: 15, fontWeight: FontWeight.w700),
        minimumSize: const Size(0, 48),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: AppColors.primary,
        side: const BorderSide(color: AppColors.border, width: 1.5),
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        textStyle: GoogleFonts.plusJakartaSans(fontSize: 15, fontWeight: FontWeight.w600),
        minimumSize: const Size(0, 48),
      ),
    ),
    dividerTheme: const DividerThemeData(color: AppColors.border, space: 0, thickness: 1),
    useMaterial3: true,
  );

  static ThemeData get dark => ThemeData(
    brightness: Brightness.dark,
    scaffoldBackgroundColor: AppColors.darkBackground,
    colorScheme: const ColorScheme.dark(
      primary: AppColors.darkPrimary,
      secondary: AppColors.accent,
      surface: AppColors.darkSurface,
      error: AppColors.error,
      onPrimary: AppColors.darkBackground,
      onSurface: AppColors.darkText,
    ),
    textTheme: _buildTextTheme(AppColors.darkText, AppColors.darkTextSecond),
    useMaterial3: true,
  );

  static TextTheme _buildTextTheme(Color primary, Color secondary) {
    return TextTheme(
      displayLarge:  GoogleFonts.spaceGrotesk(fontSize: 36, fontWeight: FontWeight.w800, color: primary),
      displayMedium: GoogleFonts.spaceGrotesk(fontSize: 28, fontWeight: FontWeight.w800, color: primary),
      headlineLarge: GoogleFonts.spaceGrotesk(fontSize: 24, fontWeight: FontWeight.w700, color: primary),
      headlineMedium:GoogleFonts.spaceGrotesk(fontSize: 20, fontWeight: FontWeight.w700, color: primary),
      headlineSmall: GoogleFonts.spaceGrotesk(fontSize: 18, fontWeight: FontWeight.w600, color: primary),
      titleLarge:    GoogleFonts.spaceGrotesk(fontSize: 16, fontWeight: FontWeight.w600, color: primary),
      titleMedium:   GoogleFonts.plusJakartaSans(fontSize: 15, fontWeight: FontWeight.w600, color: primary),
      titleSmall:    GoogleFonts.plusJakartaSans(fontSize: 14, fontWeight: FontWeight.w600, color: primary),
      bodyLarge:     GoogleFonts.plusJakartaSans(fontSize: 16, fontWeight: FontWeight.w400, color: primary),
      bodyMedium:    GoogleFonts.plusJakartaSans(fontSize: 14, fontWeight: FontWeight.w400, color: secondary),
      bodySmall:     GoogleFonts.plusJakartaSans(fontSize: 12, fontWeight: FontWeight.w400, color: secondary),
      labelLarge:    GoogleFonts.plusJakartaSans(fontSize: 14, fontWeight: FontWeight.w600, color: primary),
      labelMedium:   GoogleFonts.plusJakartaSans(fontSize: 12, fontWeight: FontWeight.w600, color: secondary),
      labelSmall:    GoogleFonts.plusJakartaSans(fontSize: 11, fontWeight: FontWeight.w500, color: secondary),
    );
  }
}

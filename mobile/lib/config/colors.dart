import 'package:flutter/material.dart';

// DukaOS Color System
// Primary: Deep Tanzania green — distinctive from all blue-heavy competitors
// Accent:  Market gold — vibrant, East African energy
// No gradients anywhere

class AppColors {
  AppColors._();

  // ── Primary (Deep Tanzania Green) ──
  static const Color primary        = Color(0xFF0B5C2E);
  static const Color primaryHover   = Color(0xFF0D6E37);
  static const Color primaryLight   = Color(0xFFE8F5EE);
  static const Color primaryDim     = Color(0xFF1A7A42);

  // ── Accent (Market Gold) ──
  static const Color accent         = Color(0xFFE8A400);
  static const Color accentHover    = Color(0xFFD49400);
  static const Color accentLight    = Color(0xFFFFF8E1);

  // ── Neutrals ──
  static const Color background     = Color(0xFFF7F9F6);
  static const Color surface        = Color(0xFFFFFFFF);
  static const Color surface2       = Color(0xFFF2F5F1);
  static const Color border         = Color(0xFFDDE5DA);
  static const Color borderStrong   = Color(0xFFBDC9B8);

  // ── Text ──
  static const Color textPrimary    = Color(0xFF111D0F);
  static const Color textSecondary  = Color(0xFF5A6B56);
  static const Color textMuted      = Color(0xFF8D9E88);

  // ── Semantic ──
  static const Color success        = Color(0xFF16A34A);
  static const Color successBg      = Color(0xFFF0FDF4);
  static const Color error          = Color(0xFFDC2626);
  static const Color errorBg        = Color(0xFFFEF2F2);
  static const Color warning        = Color(0xFFD97706);
  static const Color warningBg      = Color(0xFFFFFBEB);
  static const Color info           = Color(0xFF0369A1);
  static const Color infoBg         = Color(0xFFEFF6FF);

  // ── Dark mode ──
  static const Color darkBackground = Color(0xFF0A0F09);
  static const Color darkSurface    = Color(0xFF111A0E);
  static const Color darkSurface2   = Color(0xFF182515);
  static const Color darkBorder     = Color(0xFF243B1E);
  static const Color darkText       = Color(0xFFE8F5E9);
  static const Color darkTextSecond = Color(0xFF9DB89A);
  static const Color darkPrimary    = Color(0xFF4ADE80);
}

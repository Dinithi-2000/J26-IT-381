import 'package:flutter/material.dart';

class AppTheme {
  // ──────────────────────────────────────────────
  //  Canvas & Surface  (shadow-only, no harsh borders)
  // ──────────────────────────────────────────────
  static const Color canvasColor = Color(0xFFF8F9FA);   // off-white
  static const Color surfaceColor = Color(0xFFFFFFFF);   // pure white cards
  static const Color surfaceSubtle = Color(0xFFF3F4F6);  // light gray pills
  static const Color surfaceDim = Color(0xFFF0F2F5);
  static const Color borderColor = Color(0xFFE5E7EB);    // very subtle
  static const Color borderLight = Color(0xFFF0F2F5);

  // ──────────────────────────────────────────────
  //  Deep Industrial Forest Green (Primary)
  // ──────────────────────────────────────────────
  static const Color green900 = Color(0xFF0F5132);
  static const Color green800 = Color(0xFF14532D);
  static const Color primaryGreen = Color(0xFF15803D);
  static const Color green600 = Color(0xFF16A34A);
  static const Color primaryContainer = Color(0xFFDCFCE7);
  static const Color green50 = Color(0xFFF0FDF4);

  // ──────────────────────────────────────────────
  //  Warm Cinnamon Amber / Gold (Accent)
  // ──────────────────────────────────────────────
  static const Color amber700 = Color(0xFFB45309);
  static const Color cinnamonAccent = Color(0xFFD97706);
  static const Color amber500 = Color(0xFFF59E0B);
  static const Color cinnamonContainer = Color(0xFFFEF3C7);
  static const Color amber50 = Color(0xFFFFFBEB);

  // ──────────────────────────────────────────────
  //  Emerald (C5 grades)
  // ──────────────────────────────────────────────
  static const Color emerald700 = Color(0xFF047857);
  static const Color emerald600 = Color(0xFF059669);
  static const Color emerald100 = Color(0xFFD1FAE5);

  // ──────────────────────────────────────────────
  //  Typography Colors
  // ──────────────────────────────────────────────
  static const Color darkText = Color(0xFF111827);
  static const Color secondaryText = Color(0xFF6B7280);
  static const Color tertiaryText = Color(0xFF9CA3AF);

  // ──────────────────────────────────────────────
  //  Grade Semantic Colors
  // ──────────────────────────────────────────────
  static const Color albaColor = Color(0xFF92400E);    // amber-800 text
  static const Color albaBg = Color(0xFFFEF3C7);       // amber-100 bg
  static const Color c5Color = Color(0xFF047857);      // emerald-700 text
  static const Color c5Bg = Color(0xFFD1FAE5);         // emerald-100 bg
  static const Color c4Color = Color(0xFFD97706);
  static const Color m5Color = Color(0xFFEA580C);
  static const Color commercialColor = Color(0xFF334155); // slate-700
  static const Color commercialBg = Color(0xFFF1F5F9);    // slate-100

  static const Color errorColor = Color(0xFFDC2626);
  static const Color errorBg = Color(0xFFFEE2E2);
  static const Color successColor = Color(0xFF22C55E);

  // ──────────────────────────────────────────────
  //  Gradients
  // ──────────────────────────────────────────────
  static const LinearGradient heroGradient = LinearGradient(
    colors: [Color(0xFF0F5132), Color(0xFF14532D), Color(0xFF1A6B3E)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const LinearGradient fabGradient = LinearGradient(
    colors: [Color(0xFF14532D), Color(0xFF0F5132)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  // ──────────────────────────────────────────────
  //  Shadows (use instead of borders)
  // ──────────────────────────────────────────────
  static List<BoxShadow> get cardShadow => [
    BoxShadow(
      color: Colors.black.withValues(alpha: 0.04),
      blurRadius: 3,
      offset: const Offset(0, 1),
    ),
    BoxShadow(
      color: Colors.black.withValues(alpha: 0.02),
      blurRadius: 2,
      offset: const Offset(0, 1),
    ),
  ];

  static List<BoxShadow> get elevatedShadow => [
    BoxShadow(
      color: Colors.black.withValues(alpha: 0.06),
      blurRadius: 12,
      offset: const Offset(0, 4),
    ),
    BoxShadow(
      color: Colors.black.withValues(alpha: 0.04),
      blurRadius: 3,
      offset: const Offset(0, 1),
    ),
  ];

  static List<BoxShadow> get navShadow => [
    BoxShadow(
      color: Colors.black.withValues(alpha: 0.08),
      blurRadius: 24,
      offset: const Offset(0, -4),
    ),
    BoxShadow(
      color: Colors.black.withValues(alpha: 0.04),
      blurRadius: 6,
      offset: const Offset(0, -1),
    ),
  ];

  static List<BoxShadow> get fabShadow => [
    BoxShadow(
      color: green900.withValues(alpha: 0.35),
      blurRadius: 20,
      offset: const Offset(0, 6),
    ),
    BoxShadow(
      color: green900.withValues(alpha: 0.15),
      blurRadius: 6,
      offset: const Offset(0, 2),
    ),
  ];

  // ──────────────────────────────────────────────
  //  Theme Data
  // ──────────────────────────────────────────────
  static ThemeData get lightTheme {
    return ThemeData(
      useMaterial3: true,
      fontFamily: 'Inter',
      colorScheme: const ColorScheme.light(
        primary: primaryGreen,
        onPrimary: Colors.white,
        primaryContainer: primaryContainer,
        onPrimaryContainer: primaryGreen,
        secondary: cinnamonAccent,
        onSecondary: Colors.white,
        secondaryContainer: cinnamonContainer,
        onSecondaryContainer: cinnamonAccent,
        surface: surfaceColor,
        onSurface: darkText,
        surfaceContainerHighest: surfaceSubtle,
        outline: borderColor,
        error: errorColor,
        onError: Colors.white,
      ),
      scaffoldBackgroundColor: canvasColor,
      cardTheme: CardThemeData(
        color: surfaceColor,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
        ),
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: surfaceColor,
        foregroundColor: darkText,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        titleTextStyle: TextStyle(
          color: darkText,
          fontSize: 18,
          fontWeight: FontWeight.w700,
          letterSpacing: -0.3,
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: primaryGreen,
          foregroundColor: Colors.white,
          elevation: 0,
          minimumSize: const Size.fromHeight(50),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          textStyle: const TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: darkText,
          elevation: 0,
          minimumSize: const Size.fromHeight(50),
          side: const BorderSide(color: borderColor, width: 1),
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
        fillColor: surfaceColor,
        hintStyle: const TextStyle(color: tertiaryText, fontSize: 14),
        labelStyle: const TextStyle(color: secondaryText, fontSize: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: borderColor),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: borderColor),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: primaryGreen, width: 1.5),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      ),
      dividerTheme: const DividerThemeData(
        color: borderColor,
        thickness: 1,
        space: 20,
      ),
      textTheme: const TextTheme(
        displayLarge: TextStyle(color: darkText, fontSize: 28, fontWeight: FontWeight.w700, letterSpacing: -0.5),
        titleLarge: TextStyle(color: darkText, fontSize: 20, fontWeight: FontWeight.w700, letterSpacing: -0.3),
        titleMedium: TextStyle(color: darkText, fontSize: 16, fontWeight: FontWeight.w600),
        titleSmall: TextStyle(color: darkText, fontSize: 14, fontWeight: FontWeight.w600),
        bodyLarge: TextStyle(color: darkText, fontSize: 15, height: 1.5),
        bodyMedium: TextStyle(color: secondaryText, fontSize: 14, height: 1.4),
        bodySmall: TextStyle(color: tertiaryText, fontSize: 12),
      ),
    );
  }
}

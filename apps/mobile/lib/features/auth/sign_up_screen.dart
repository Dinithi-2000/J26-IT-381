import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/services/auth_service.dart';
import '../../theme.dart';

class SignUpScreen extends ConsumerStatefulWidget {
  const SignUpScreen({super.key});

  @override
  ConsumerState<SignUpScreen> createState() => _SignUpScreenState();
}

class _SignUpScreenState extends ConsumerState<SignUpScreen>
    with SingleTickerProviderStateMixin {
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _isLoading = false;
  bool _obscurePassword = true;

  late AnimationController _animController;
  late Animation<double> _fadeIn;
  late Animation<Offset> _slideUp;
  late Animation<double> _logoScale;

  @override
  void initState() {
    super.initState();

    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    );

    _fadeIn = CurvedAnimation(
      parent: _animController,
      curve: const Interval(0.0, 0.6, curve: Curves.easeOut),
    );

    _slideUp = Tween<Offset>(begin: const Offset(0, 0.15), end: Offset.zero)
        .animate(
          CurvedAnimation(
            parent: _animController,
            curve: const Interval(0.2, 0.8, curve: Curves.easeOutCubic),
          ),
        );

    _logoScale = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _animController,
        curve: const Interval(0.0, 0.5, curve: Curves.elasticOut),
      ),
    );

    _animController.forward();
  }

  Future<void> _signUp() async {
    if (_emailController.text.trim().isEmpty ||
        _passwordController.text.length < 6) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text(
            'Please enter a valid email and at least 6 characters password.',
          ),
          backgroundColor: AppTheme.errorColor,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
          ),
          margin: const EdgeInsets.all(16),
        ),
      );
      return;
    }

    setState(() => _isLoading = true);
    try {
      await ref
          .read(authServiceProvider)
          .createUserWithEmailAndPassword(
            _emailController.text.trim(),
            _passwordController.text,
          );
      if (mounted) {
        context.go('/');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Registration failed: $e'),
            backgroundColor: AppTheme.errorColor,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(10),
            ),
            margin: const EdgeInsets.all(16),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  void dispose() {
    _animController.dispose();
    _nameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // Immersive status bar for the cinematic background
    SystemChrome.setSystemUIOverlayStyle(
      const SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.light,
        statusBarBrightness: Brightness.dark,
      ),
    );

    return Scaffold(
      body: Stack(
        fit: StackFit.expand,
        children: [
          // ── Full-screen cinnamon background ──────────────────────
          Image.asset(
            'assets/images/cinnamon_bg.jpg',
            fit: BoxFit.cover,
            width: double.infinity,
            height: double.infinity,
          ),

          // ── Dark gradient overlay ───────────────────────────────
          Container(
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  Color(0x90000000),
                  Color(0x40000000),
                  Color(0xCC1A0E00),
                ],
                stops: [0.0, 0.35, 1.0],
              ),
            ),
          ),

          // ── Main content ────────────────────────────────────────
          SafeArea(
            child: Column(
              children: [
                // ── Back button ─────────────────────────────────
                Align(
                  alignment: Alignment.topLeft,
                  child: Padding(
                    padding: const EdgeInsets.only(left: 8, top: 4),
                    child: IconButton(
                      onPressed: () => context.go('/login'),
                      icon: const Icon(
                        Icons.arrow_back_ios_new_rounded,
                        color: Colors.white,
                        size: 20,
                      ),
                      style: IconButton.styleFrom(
                        backgroundColor: Colors.white.withValues(alpha: 0.12),
                        padding: const EdgeInsets.all(10),
                      ),
                    ),
                  ),
                ),

                // ── Scrollable form ─────────────────────────────
                Expanded(
                  child: Center(
                    child: SingleChildScrollView(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 28.0,
                        vertical: 16,
                      ),
                      child: FadeTransition(
                        opacity: _fadeIn,
                        child: SlideTransition(
                          position: _slideUp,
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              // ── Floating Card ─────────────────
                              Container(
                                padding: const EdgeInsets.fromLTRB(
                                  28,
                                  36,
                                  28,
                                  28,
                                ),
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  borderRadius: BorderRadius.circular(28),
                                  boxShadow: [
                                    BoxShadow(
                                      color: Colors.black.withValues(
                                        alpha: 0.18,
                                      ),
                                      blurRadius: 60,
                                      spreadRadius: -8,
                                      offset: const Offset(0, 24),
                                    ),
                                    BoxShadow(
                                      color: Colors.black.withValues(
                                        alpha: 0.08,
                                      ),
                                      blurRadius: 20,
                                      offset: const Offset(0, 8),
                                    ),
                                  ],
                                ),
                                child: Column(
                                  crossAxisAlignment:
                                      CrossAxisAlignment.stretch,
                                  children: [
                                    // ── Logo ────────────────────
                                    Center(
                                      child: ScaleTransition(
                                        scale: _logoScale,
                                        child: Container(
                                          width: 64,
                                          height: 64,
                                          decoration: BoxDecoration(
                                            color: const Color(0xFFEBFBF0),
                                            borderRadius: BorderRadius.circular(
                                              18,
                                            ),
                                          ),
                                          child: const Icon(
                                            Icons.eco_rounded,
                                            size: 34,
                                            color: AppTheme.primaryGreen,
                                          ),
                                        ),
                                      ),
                                    ),
                                    const SizedBox(height: 18),

                                    // ── Title ───────────────────
                                    const Text(
                                      'QuillGrade',
                                      textAlign: TextAlign.center,
                                      style: TextStyle(
                                        fontSize: 26,
                                        fontWeight: FontWeight.w800,
                                        color: AppTheme.darkText,
                                        letterSpacing: -0.5,
                                      ),
                                    ),
                                    const SizedBox(height: 4),
                                    const Text(
                                      'Create your account',
                                      textAlign: TextAlign.center,
                                      style: TextStyle(
                                        fontSize: 13,
                                        color: AppTheme.secondaryText,
                                        letterSpacing: 0.2,
                                      ),
                                    ),
                                    const SizedBox(height: 28),

                                    // ── Full Name Field ─────────
                                    _buildInputField(
                                      controller: _nameController,
                                      hintText: 'Full Name',
                                      prefixIcon: Icons.person_outline_rounded,
                                    ),
                                    const SizedBox(height: 14),

                                    // ── Email Field ─────────────
                                    _buildInputField(
                                      controller: _emailController,
                                      hintText: 'Email',
                                      prefixIcon: Icons.mail_outline_rounded,
                                      keyboardType: TextInputType.emailAddress,
                                    ),
                                    const SizedBox(height: 14),

                                    // ── Password Field ──────────
                                    _buildInputField(
                                      controller: _passwordController,
                                      hintText: 'Password',
                                      prefixIcon: Icons.lock_outline_rounded,
                                      obscureText: _obscurePassword,
                                      suffixIcon: IconButton(
                                        icon: Icon(
                                          _obscurePassword
                                              ? Icons.visibility_off_outlined
                                              : Icons.visibility_outlined,
                                          size: 20,
                                          color: AppTheme.tertiaryText,
                                        ),
                                        onPressed: () => setState(
                                          () => _obscurePassword =
                                              !_obscurePassword,
                                        ),
                                      ),
                                    ),
                                    const SizedBox(height: 24),

                                    // ── Create Account Button ───
                                    _buildCreateAccountButton(),
                                  ],
                                ),
                              ),

                              const SizedBox(height: 28),

                              // ── Log In link (outside card) ────
                              Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  const Text(
                                    "Already have an account? ",
                                    style: TextStyle(
                                      color: Color(0xBBFFFFFF),
                                      fontSize: 13,
                                    ),
                                  ),
                                  GestureDetector(
                                    onTap: () => context.go('/login'),
                                    child: const Text(
                                      'Log In',
                                      style: TextStyle(
                                        color: Colors.white,
                                        fontWeight: FontWeight.w700,
                                        fontSize: 13,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ── Custom rounded input with gray fill ──────────────────────────
  Widget _buildInputField({
    required TextEditingController controller,
    required String hintText,
    required IconData prefixIcon,
    TextInputType? keyboardType,
    bool obscureText = false,
    Widget? suffixIcon,
  }) {
    return TextField(
      controller: controller,
      keyboardType: keyboardType,
      obscureText: obscureText,
      style: const TextStyle(
        fontSize: 15,
        color: AppTheme.darkText,
        fontWeight: FontWeight.w500,
      ),
      decoration: InputDecoration(
        hintText: hintText,
        hintStyle: const TextStyle(
          color: AppTheme.tertiaryText,
          fontWeight: FontWeight.w400,
          fontSize: 14,
        ),
        prefixIcon: Icon(prefixIcon, size: 20, color: AppTheme.tertiaryText),
        suffixIcon: suffixIcon,
        filled: true,
        fillColor: const Color(0xFFF3F4F6),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide.none,
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(
            color: AppTheme.primaryGreen,
            width: 1.5,
          ),
        ),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 16,
          vertical: 16,
        ),
      ),
    );
  }

  // ── Prominent green Create Account button ────────────────────────
  Widget _buildCreateAccountButton() {
    return SizedBox(
      height: 54,
      child: ElevatedButton(
        onPressed: _isLoading ? null : _signUp,
        style: ElevatedButton.styleFrom(
          backgroundColor: AppTheme.primaryGreen,
          foregroundColor: Colors.white,
          disabledBackgroundColor: AppTheme.primaryGreen.withValues(alpha: 0.6),
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
          textStyle: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.3,
          ),
        ),
        child: _isLoading
            ? const SizedBox(
                height: 22,
                width: 22,
                child: CircularProgressIndicator(
                  color: Colors.white,
                  strokeWidth: 2.5,
                ),
              )
            : const Text('Create Account'),
      ),
    );
  }
}

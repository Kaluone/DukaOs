import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../core/services/auth_service.dart';
import '../../../config/colors.dart';
import '../../../config/constants.dart';

class OwnerLoginScreen extends StatefulWidget {
  const OwnerLoginScreen({super.key});

  @override
  State<OwnerLoginScreen> createState() => _OwnerLoginScreenState();
}

class _OwnerLoginScreenState extends State<OwnerLoginScreen> {
  bool _loading = false;

  Future<void> _handleGoogleSignIn() async {
    setState(() => _loading = true);
    try {
      await AuthService.signInWithGoogle();
      if (mounted) context.go('/dashboard');
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Hitilafu ya kuingia. Jaribu tena.'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(AppConstants.space6),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 48),

              // Brand
              Container(
                width: 64, height: 64,
                decoration: BoxDecoration(
                  color: AppColors.primary,
                  borderRadius: BorderRadius.circular(AppConstants.radiusL),
                ),
                child: const Icon(Icons.store_rounded, color: Colors.white, size: 32),
              ),
              const SizedBox(height: AppConstants.space5),
              Text('DukaOS', style: Theme.of(context).textTheme.displayMedium?.copyWith(fontWeight: FontWeight.w800)),
              const SizedBox(height: AppConstants.space2),
              Text(
                'Biashara yako, kiganjani mwako',
                style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                  color: AppColors.textSecondary,
                  fontStyle: FontStyle.italic,
                ),
              ),

              const SizedBox(height: AppConstants.space12),

              // Card
              Container(
                padding: const EdgeInsets.all(AppConstants.space6),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(AppConstants.radiusXL),
                  border: Border.all(color: AppColors.border),
                  boxShadow: [BoxShadow(color: AppColors.primary.withOpacity(0.08), blurRadius: 20, offset: const Offset(0, 4))],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Karibu tena', style: Theme.of(context).textTheme.headlineMedium),
                    const SizedBox(height: AppConstants.space2),
                    Text(
                      'Ingia ili kuona hali ya duka lako wakati wowote.',
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                    const SizedBox(height: AppConstants.space6),

                    // Google button
                    _loading
                        ? const Center(child: CircularProgressIndicator(color: AppColors.primary, strokeWidth: 2.5))
                        : SizedBox(
                            width: double.infinity,
                            child: OutlinedButton(
                              onPressed: _handleGoogleSignIn,
                              style: OutlinedButton.styleFrom(
                                side: const BorderSide(color: AppColors.border, width: 1.5),
                                padding: const EdgeInsets.symmetric(vertical: 14),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                              ),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  _GoogleIcon(),
                                  const SizedBox(width: 12),
                                  Text('Ingia kwa Google',
                                    style: Theme.of(context).textTheme.labelLarge?.copyWith(fontSize: 15)),
                                ],
                              ),
                            ),
                          ),

                    const SizedBox(height: AppConstants.space5),
                    const Divider(color: AppColors.border),
                    const SizedBox(height: AppConstants.space4),

                    // Staff PIN option
                    Center(
                      child: TextButton(
                        onPressed: () => context.push('/staff-pin'),
                        child: const Text(
                          'Ingia kama Mfanyakazi (PIN)',
                          style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.w600),
                        ),
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: AppConstants.space8),
              Center(
                child: Text(
                  '© 2026 DukaOS · AutoRevenue Labs',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// Inline Google SVG icon
class _GoogleIcon extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 20, height: 20,
      child: CustomPaint(painter: _GooglePainter()),
    );
  }
}

class _GooglePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    // Simplified colored G icon via paths
    final paint = Paint()..style = PaintingStyle.fill;
    // Blue
    paint.color = const Color(0xFF4285F4);
    canvas.drawCircle(Offset(size.width/2, size.height/2), size.width/2, paint);
    paint.color = Colors.white;
    canvas.drawCircle(Offset(size.width/2, size.height/2), size.width/2 * 0.6, paint);
    paint.color = const Color(0xFF4285F4);
    canvas.drawRect(Rect.fromLTWH(size.width/2, size.height/2 - size.height*0.1, size.width/2*0.8, size.height*0.2), paint);
  }
  @override
  bool shouldRepaint(_) => false;
}

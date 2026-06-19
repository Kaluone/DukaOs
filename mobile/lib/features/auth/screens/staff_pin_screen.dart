import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../core/services/auth_service.dart';
import '../../../config/colors.dart';
import '../../../config/constants.dart';
import '../widgets/pin_pad.dart';

class StaffPinScreen extends StatefulWidget {
  const StaffPinScreen({super.key});

  @override
  State<StaffPinScreen> createState() => _StaffPinScreenState();
}

class _StaffPinScreenState extends State<StaffPinScreen> {
  String _pin = '';
  bool _loading = false;
  bool _error = false;
  Map<String, dynamic>? _shop;

  @override
  void initState() {
    super.initState();
    _loadShop();
  }

  Future<void> _loadShop() async {
    final shop = await AuthService.getMyShop();
    if (mounted) setState(() => _shop = shop);
  }

  void _onDigit(String d) {
    if (_pin.length >= AppConstants.pinMaxLength) return;
    setState(() { _pin += d; _error = false; });
    if (_pin.length >= AppConstants.pinMinLength) _tryLogin();
  }

  void _onDelete() {
    if (_pin.isEmpty) return;
    setState(() => _pin = _pin.substring(0, _pin.length - 1));
  }

  Future<void> _tryLogin() async {
    if (_shop == null) return;
    setState(() => _loading = true);

    final staff = await AuthService.verifyStaffPin(
      shopId: _shop!['id'] as String,
      pin: _pin,
    );

    if (!mounted) return;
    if (staff != null) {
      // Store staff session locally and go to POS
      context.go('/pos', extra: staff);
    } else {
      setState(() { _error = true; _loading = false; _pin = ''; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded),
          onPressed: () => context.pop(),
        ),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(AppConstants.space6),
          child: Column(
            children: [
              const Spacer(),
              // Header
              Container(
                width: 56, height: 56,
                decoration: BoxDecoration(
                  color: AppColors.primary,
                  borderRadius: BorderRadius.circular(AppConstants.radiusL),
                ),
                child: const Icon(Icons.lock_rounded, color: Colors.white, size: 28),
              ),
              const SizedBox(height: AppConstants.space4),
              Text('Weka PIN Yako', style: Theme.of(context).textTheme.headlineMedium),
              const SizedBox(height: AppConstants.space2),
              Text(
                _shop?['name'] as String? ?? 'DukaOS',
                style: Theme.of(context).textTheme.bodyMedium,
              ),

              const SizedBox(height: AppConstants.space8),

              // PIN dots
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(AppConstants.pinMinLength, (i) {
                  final filled = i < _pin.length;
                  return AnimatedContainer(
                    duration: AppConstants.animFast,
                    margin: const EdgeInsets.symmetric(horizontal: 8),
                    width: 18, height: 18,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: _error
                          ? AppColors.error
                          : filled ? AppColors.primary : AppColors.border,
                      border: filled || _error ? null : Border.all(color: AppColors.borderStrong),
                    ),
                  );
                }),
              ),

              if (_error) ...[
                const SizedBox(height: AppConstants.space3),
                Text('PIN si sahihi. Jaribu tena.',
                  style: const TextStyle(color: AppColors.error, fontSize: 13, fontWeight: FontWeight.w500)),
              ],

              const SizedBox(height: AppConstants.space8),

              // PIN pad
              if (_loading)
                const CircularProgressIndicator(color: AppColors.primary, strokeWidth: 2.5)
              else
                PinPad(onDigit: _onDigit, onDelete: _onDelete),

              const Spacer(),
            ],
          ),
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/providers/providers.dart';
import '../../../core/services/auth_service.dart';
import '../../../models/transaction_model.dart';
import '../../../config/colors.dart';
import '../../../config/constants.dart';

class CartScreen extends ConsumerStatefulWidget {
  const CartScreen({super.key});

  @override
  ConsumerState<CartScreen> createState() => _CartScreenState();
}

class _CartScreenState extends ConsumerState<CartScreen> {
  String _paymentMethod = 'cash';
  bool _loading = false;

  final _paymentMethods = const [
    {'value': 'cash',        'label': 'Taslimu'},
    {'value': 'mpesa',       'label': 'M-Pesa'},
    {'value': 'tigopesa',    'label': 'Tigo Pesa'},
    {'value': 'airtelmoney', 'label': 'Airtel Money'},
    {'value': 'halopesa',    'label': 'HaloPesa'},
  ];

  String _fmt(double n) => 'TZS ${n.toStringAsFixed(0).replaceAllMapped(
    RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'),
    (m) => '${m[1]},',
  )}';

  Future<void> _completeSale(List<CartItem> cart, Map<String, dynamic> shop) async {
    setState(() => _loading = true);
    try {
      await ref.read(transactionServiceProvider).recordSale(
        shopId:        shop['id'] as String,
        staffId:       ref.read(activeStaffIdProvider),
        items:         cart,
        paymentMethod: _paymentMethod,
      );
      if (!mounted) return;
      await _showSuccess();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text('Hitilafu: $e'),
        backgroundColor: AppColors.error,
        behavior: SnackBarBehavior.floating,
      ));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _showSuccess() async {
    await showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => AlertDialog(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppConstants.radiusXL),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 72, height: 72,
              decoration: const BoxDecoration(
                color: AppColors.successBg,
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.check_rounded, color: AppColors.success, size: 40),
            ),
            const SizedBox(height: 16),
            const Text(
              'Mauzo Yamekamilika!',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 8),
            const Text(
              'Muamala umehifadhiwa.',
              style: TextStyle(color: AppColors.textSecondary),
            ),
          ],
        ),
        actions: [
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: () {
                Navigator.pop(context);
                context.go('/pos');
              },
              child: const Text('Muamala Mpya'),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final extra = GoRouterState.of(context).extra as Map?;
    final cart  = extra?['cart'] as List<CartItem>? ?? [];
    final shop  = extra?['shop'] as Map<String, dynamic>? ?? {};
    final total = cart.fold(0.0, (s, i) => s + i.subtotal);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title:           const Text('Kagua Muamala'),
        backgroundColor: AppColors.surface,
      ),
      body: Column(
        children: [
          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(AppConstants.space4),
              children: [
                // Cart items list
                Container(
                  decoration: BoxDecoration(
                    color:        AppColors.surface,
                    border:       Border.all(color: AppColors.border),
                    borderRadius: BorderRadius.circular(AppConstants.radiusL),
                  ),
                  child: Column(
                    children: cart.map((item) => Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: AppConstants.space4,
                        vertical:   AppConstants.space3,
                      ),
                      child: Row(
                        children: [
                          Container(
                            width: 44, height: 44,
                            decoration: BoxDecoration(
                              color:        AppColors.surface2,
                              borderRadius: BorderRadius.circular(AppConstants.radiusM),
                            ),
                            child: Center(
                              child: Text(
                                item.productName[0],
                                style: const TextStyle(
                                  fontWeight: FontWeight.w800,
                                  color:      AppColors.primary,
                                  fontSize:   18,
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(item.productName,
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w700, fontSize: 14,
                                  )),
                                Text(
                                  '${item.quantity} × ${_fmt(item.unitPrice)}',
                                  style: const TextStyle(
                                    fontSize: 12, color: AppColors.textMuted,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          Text(_fmt(item.subtotal),
                            style: const TextStyle(
                              fontWeight: FontWeight.w800,
                              color:      AppColors.primary,
                              fontSize:   14,
                            )),
                        ],
                      ),
                    )).toList(),
                  ),
                ),

                const SizedBox(height: AppConstants.space4),

                // Payment method chips
                Container(
                  decoration: BoxDecoration(
                    color:        AppColors.surface,
                    border:       Border.all(color: AppColors.border),
                    borderRadius: BorderRadius.circular(AppConstants.radiusL),
                  ),
                  padding: const EdgeInsets.all(AppConstants.space4),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Njia ya Malipo',
                        style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                      const SizedBox(height: 12),
                      Wrap(
                        spacing: 8, runSpacing: 8,
                        children: _paymentMethods.map((m) {
                          final active = _paymentMethod == m['value'];
                          return GestureDetector(
                            onTap: () => setState(() => _paymentMethod = m['value']!),
                            child: AnimatedContainer(
                              duration: AppConstants.animFast,
                              padding: const EdgeInsets.symmetric(
                                horizontal: 14, vertical: 10,
                              ),
                              decoration: BoxDecoration(
                                color:        active ? AppColors.primary : AppColors.surface2,
                                borderRadius: BorderRadius.circular(AppConstants.radiusM),
                                border: Border.all(
                                  color: active ? AppColors.primary : AppColors.border,
                                ),
                              ),
                              child: Text(m['label']!,
                                style: TextStyle(
                                  fontWeight: FontWeight.w600,
                                  fontSize:   13,
                                  color: active ? Colors.white : AppColors.textSecondary,
                                )),
                            ),
                          );
                        }).toList(),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // Total + confirm button
          Container(
            padding: const EdgeInsets.all(AppConstants.space5),
            decoration: const BoxDecoration(
              color:  AppColors.surface,
              border: Border(top: BorderSide(color: AppColors.border)),
            ),
            child: SafeArea(
              top: false,
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Jumla ya Kulipa',
                        style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
                      Text(_fmt(total),
                        style: const TextStyle(
                          fontSize: 22, fontWeight: FontWeight.w800,
                          color: AppColors.primary,
                        )),
                    ],
                  ),
                  const SizedBox(height: AppConstants.space4),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: _loading || cart.isEmpty
                          ? null
                          : () => _completeSale(cart, shop),
                      child: _loading
                          ? const SizedBox(
                              width: 20, height: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2.5, color: Colors.white,
                              ),
                            )
                          : const Text('Kamilisha Mauzo',
                              style: TextStyle(
                                fontSize: 16, fontWeight: FontWeight.w800,
                              )),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

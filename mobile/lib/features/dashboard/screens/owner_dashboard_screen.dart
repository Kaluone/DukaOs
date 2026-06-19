import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../../core/services/auth_service.dart';
import '../../../config/colors.dart';
import '../../../config/constants.dart';

class OwnerDashboardScreen extends StatefulWidget {
  const OwnerDashboardScreen({super.key});

  @override
  State<OwnerDashboardScreen> createState() => _OwnerDashboardScreenState();
}

class _OwnerDashboardScreenState extends State<OwnerDashboardScreen> {
  Map<String, dynamic>? _shop;
  Map<String, dynamic>? _summary;
  List<Map<String, dynamic>> _lowStock = [];
  List<Map<String, dynamic>> _recentTxns = [];
  bool _loading = true;
  RealtimeChannel? _channel;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _channel?.unsubscribe();
    super.dispose();
  }

  Future<void> _load() async {
    final shop = await AuthService.getMyShop();
    if (shop == null || !mounted) return;
    setState(() { _shop = shop; });
    await _fetchData(shop['id'] as String);
    _subscribeRealtime(shop['id'] as String);
  }

  Future<void> _fetchData(String shopId) async {
    final client = Supabase.instance.client;

    final results = await Future.wait([
      client.from('v_dashboard_today').select('*').eq('shop_id', shopId).maybeSingle(),
      client.from('v_low_stock').select('*').eq('shop_id', shopId).limit(4),
      client.from('transactions')
          .select('id, total_amount, payment_method, created_at, staff:staff_id(full_name)')
          .eq('shop_id', shopId)
          .order('created_at', ascending: false)
          .limit(6),
    ]);

    if (!mounted) return;
    setState(() {
      _summary  = results[0] as Map<String, dynamic>?;
      _lowStock = List<Map<String, dynamic>>.from(results[1] as List);
      _recentTxns = List<Map<String, dynamic>>.from(results[2] as List);
      _loading = false;
    });
  }

  void _subscribeRealtime(String shopId) {
    _channel = Supabase.instance.client
        .channel('owner-dash-$shopId')
        .onPostgresChanges(
          event: PostgresChangeEvent.insert,
          schema: 'public',
          table: 'transactions',
          filter: PostgresChangeFilter(type: PostgresChangeFilterType.eq, column: 'shop_id', value: shopId),
          callback: (_) => _fetchData(shopId),
        )
        .subscribe();
  }

  String _fmt(double? n) {
    final v = n ?? 0;
    return 'TZS ${v.toStringAsFixed(0).replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]},')}';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(_shop?['name'] as String? ?? 'Dashibodi'),
        backgroundColor: AppColors.surface,
        actions: [
          Row(
            children: [
              Container(
                width: 8, height: 8,
                decoration: const BoxDecoration(color: AppColors.success, shape: BoxShape.circle),
              ),
              const SizedBox(width: 4),
              const Text('Moja kwa moja', style: TextStyle(fontSize: 11, color: AppColors.success, fontWeight: FontWeight.w600)),
              const SizedBox(width: 16),
            ],
          ),
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: () => _shop != null ? _fetchData(_shop!['id'] as String) : null,
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary, strokeWidth: 2.5))
          : RefreshIndicator(
              color: AppColors.primary,
              onRefresh: () => _fetchData(_shop!['id'] as String),
              child: ListView(
                padding: const EdgeInsets.all(AppConstants.space4),
                children: [
                  // Greeting
                  Text('Habari za leo', style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppColors.textMuted)),
                  const SizedBox(height: 4),
                  Text('Dashibodi', style: Theme.of(context).textTheme.headlineLarge?.copyWith(fontWeight: FontWeight.w800)),

                  const SizedBox(height: AppConstants.space5),

                  // Metric cards row
                  Row(
                    children: [
                      Expanded(child: _MetricCard(
                        label: 'Mapato Leo',
                        value: _fmt((_summary?['revenue_today'] as num?)?.toDouble()),
                        icon: Icons.trending_up_rounded,
                        color: AppColors.primary,
                      )),
                      const SizedBox(width: AppConstants.space3),
                      Expanded(child: _MetricCard(
                        label: 'Mauzo',
                        value: '${_summary?['transactions_today'] ?? 0}',
                        icon: Icons.shopping_cart_rounded,
                        color: AppColors.success,
                      )),
                    ],
                  ),
                  const SizedBox(height: AppConstants.space3),
                  Row(
                    children: [
                      Expanded(child: _MetricCard(
                        label: 'Stok Chini',
                        value: '${_summary?['low_stock_count'] ?? 0}',
                        icon: Icons.warning_rounded,
                        color: AppColors.warning,
                      )),
                      const SizedBox(width: AppConstants.space3),
                      Expanded(child: _MetricCard(
                        label: 'Wafanyakazi',
                        value: '${_summary?['active_staff_today'] ?? 0}',
                        icon: Icons.people_rounded,
                        color: AppColors.accent,
                      )),
                    ],
                  ),

                  // Low stock alerts
                  if (_lowStock.isNotEmpty) ...[
                    const SizedBox(height: AppConstants.space6),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('Bidhaa Zinazokwisha', style: Theme.of(context).textTheme.titleMedium),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                            color: AppColors.warningBg,
                            borderRadius: BorderRadius.circular(AppConstants.radiusFull),
                          ),
                          child: Text('${_lowStock.length}', style: const TextStyle(color: AppColors.warning, fontSize: 12, fontWeight: FontWeight.w700)),
                        ),
                      ],
                    ),
                    const SizedBox(height: AppConstants.space3),
                    ..._lowStock.map((item) => _StockAlertCard(item: item)),
                  ],

                  // Recent transactions
                  const SizedBox(height: AppConstants.space6),
                  Text('Mauzo ya Karibuni', style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: AppConstants.space3),
                  ..._recentTxns.isEmpty
                      ? [Center(child: Padding(
                          padding: const EdgeInsets.symmetric(vertical: 32),
                          child: Text('Hakuna mauzo leo', style: const TextStyle(color: AppColors.textMuted)),
                        ))]
                      : _recentTxns.map((txn) => _TxnCard(txn: txn, fmt: _fmt)),

                  const SizedBox(height: 80), // bottom nav clearance
                ],
              ),
            ),
    );
  }
}

class _MetricCard extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color color;

  const _MetricCard({required this.label, required this.value, required this.icon, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppConstants.space4),
      decoration: BoxDecoration(
        color: AppColors.surface,
        border: Border.all(color: AppColors.border),
        borderRadius: BorderRadius.circular(AppConstants.radiusL),
        boxShadow: [BoxShadow(color: AppColors.primary.withOpacity(0.04), blurRadius: 8, offset: const Offset(0,2))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(label, style: const TextStyle(fontSize: 11, color: AppColors.textMuted, fontWeight: FontWeight.w500)),
              Container(
                width: 32, height: 32,
                decoration: BoxDecoration(color: color.withOpacity(0.12), borderRadius: BorderRadius.circular(8)),
                child: Icon(icon, size: 18, color: color),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(value, style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800, fontSize: 18)),
        ],
      ),
    );
  }
}

class _StockAlertCard extends StatelessWidget {
  final Map<String, dynamic> item;
  const _StockAlertCard({required this.item});

  @override
  Widget build(BuildContext context) {
    final qty = item['quantity'] as int;
    final threshold = item['reorder_threshold'] as int;
    final isEmpty = qty == 0;

    return Container(
      margin: const EdgeInsets.only(bottom: AppConstants.space2),
      padding: const EdgeInsets.all(AppConstants.space4),
      decoration: BoxDecoration(
        color: AppColors.surface,
        border: Border.all(color: isEmpty ? AppColors.error.withOpacity(0.3) : AppColors.warning.withOpacity(0.3)),
        borderRadius: BorderRadius.circular(AppConstants.radiusL),
      ),
      child: Row(
        children: [
          Container(
            width: 40, height: 40,
            decoration: BoxDecoration(
              color: isEmpty ? AppColors.errorBg : AppColors.warningBg,
              borderRadius: BorderRadius.circular(AppConstants.radiusM),
            ),
            child: Icon(isEmpty ? Icons.error_outline_rounded : Icons.warning_amber_rounded,
              color: isEmpty ? AppColors.error : AppColors.warning, size: 22),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(item['product_name'] as String, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                Text('Iliyobaki: $qty / Kiwango: $threshold', style: const TextStyle(fontSize: 12, color: AppColors.textMuted)),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: isEmpty ? AppColors.errorBg : AppColors.warningBg,
              borderRadius: BorderRadius.circular(AppConstants.radiusFull),
            ),
            child: Text(isEmpty ? 'Imeisha' : 'Kidogo',
              style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700,
                color: isEmpty ? AppColors.error : AppColors.warning)),
          ),
        ],
      ),
    );
  }
}

class _TxnCard extends StatelessWidget {
  final Map<String, dynamic> txn;
  final String Function(double?) fmt;
  const _TxnCard({required this.txn, required this.fmt});

  @override
  Widget build(BuildContext context) {
    final amount = (txn['total_amount'] as num).toDouble();
    final method = txn['payment_method'] as String;
    final staff  = (txn['staff'] as Map?)?['full_name'] as String?;
    final time   = DateTime.parse(txn['created_at'] as String).toLocal();
    final timeStr = '${time.hour.toString().padLeft(2,'0')}:${time.minute.toString().padLeft(2,'0')}';

    final methodIcons = {
      'cash': Icons.payments_rounded, 'mpesa': Icons.phone_android_rounded,
      'tigopesa': Icons.phone_android_rounded, 'airtelmoney': Icons.phone_android_rounded,
      'halopesa': Icons.phone_android_rounded,
    };
    final methodLabels = {
      'cash': 'Taslimu', 'mpesa': 'M-Pesa', 'tigopesa': 'Tigo Pesa',
      'airtelmoney': 'Airtel Money', 'halopesa': 'HaloPesa',
    };

    return Container(
      margin: const EdgeInsets.only(bottom: AppConstants.space2),
      padding: const EdgeInsets.all(AppConstants.space4),
      decoration: BoxDecoration(
        color: AppColors.surface,
        border: Border.all(color: AppColors.border),
        borderRadius: BorderRadius.circular(AppConstants.radiusL),
      ),
      child: Row(
        children: [
          Container(
            width: 42, height: 42,
            decoration: BoxDecoration(color: AppColors.primaryLight, borderRadius: BorderRadius.circular(AppConstants.radiusM)),
            child: Icon(methodIcons[method] ?? Icons.receipt_rounded, color: AppColors.primary, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(methodLabels[method] ?? method, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                if (staff != null) Text(staff, style: const TextStyle(fontSize: 12, color: AppColors.textMuted)),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(fmt(amount), style: const TextStyle(fontWeight: FontWeight.w800, color: AppColors.primary, fontSize: 14)),
              Text(timeStr, style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
            ],
          ),
        ],
      ),
    );
  }
}

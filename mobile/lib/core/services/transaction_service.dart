import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:uuid/uuid.dart';
import '../../models/transaction_model.dart';
import 'offline_queue_service.dart';

class TransactionService {
  final SupabaseClient _supabase;
  final OfflineQueueService _queue;
  static const _uuid = Uuid();

  TransactionService({
    required SupabaseClient supabase,
    required OfflineQueueService queue,
  })  : _supabase = supabase,
        _queue = queue;

  /// Record a sale. Writes locally first; syncs to Supabase when connected.
  Future<String> recordSale({
    required String shopId,
    required String? staffId,
    required List<CartItem> items,
    required String paymentMethod,
  }) async {
    final offlineId = _uuid.v4();
    final total = items.fold(0.0, (s, i) => s + i.subtotal);

    final txn = PendingTransaction(
      offlineId:     offlineId,
      shopId:        shopId,
      staffId:       staffId,
      paymentMethod: paymentMethod,
      totalAmount:   total,
      items:         items,
      createdAt:     DateTime.now(),
    );

    await _queue.enqueue(txn);

    try {
      await _syncOne(txn);
    } catch (_) {
      // Offline — retried by syncPending() on next foreground resume
    }

    return offlineId;
  }

  /// Push all locally queued transactions to Supabase. Returns the count synced.
  Future<int> syncPending() async {
    int synced = 0;
    for (final txn in _queue.getPending()) {
      try {
        await _syncOne(txn);
        synced++;
      } catch (_) {
        // Individual failure — continue with others
      }
    }
    return synced;
  }

  Future<void> _syncOne(PendingTransaction txn) async {
    final row = await _supabase.from('transactions').insert({
      'shop_id':        txn.shopId,
      'staff_id':       txn.staffId,
      'payment_method': txn.paymentMethod,
      'total_amount':   txn.totalAmount,
      'sync_status':    'synced',
      'offline_id':     txn.offlineId,
      'created_at':     txn.createdAt.toIso8601String(),
    }).select('id').single();

    final txnId = row['id'] as String;

    await _supabase.from('transaction_items').insert(
      txn.items.map((i) => {
        'transaction_id': txnId,
        'product_id':     i.productId,
        'shop_id':        txn.shopId,
        'quantity':       i.quantity,
        'unit_price':     i.unitPrice,
      }).toList(),
    );

    await _queue.markSynced(txn.offlineId);

    // Fire-and-forget — notification failure must not block the sale
    _supabase.functions.invoke('notify-sale', body: {
      'transaction_id': txnId,
      'shop_id':        txn.shopId,
    }).ignore();
  }

  Future<List<Map<String, dynamic>>> getRecent(String shopId, {int limit = 20}) async {
    final res = await _supabase
        .from('transactions')
        .select('*, staff:staff_id(full_name)')
        .eq('shop_id', shopId)
        .order('created_at', ascending: false)
        .limit(limit);
    return List<Map<String, dynamic>>.from(res);
  }
}

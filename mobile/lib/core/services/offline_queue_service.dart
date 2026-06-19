import 'package:hive_flutter/hive_flutter.dart';
import '../../models/transaction_model.dart';

/// Manages the local queue of transactions waiting to sync.
/// Uses Box<Map> — no Hive type adapters or code generation required.
class OfflineQueueService {
  static const _boxName = 'offline_transactions';
  Box<Map>? _box;

  Future<void> init() async {
    _box = await Hive.openBox<Map>(_boxName);
  }

  Box<Map> get _b {
    assert(_box != null, 'OfflineQueueService.init() must be called first');
    return _box!;
  }

  Future<void> enqueue(PendingTransaction txn) async {
    await _b.put(txn.offlineId, txn.toMap());
  }

  Future<void> markSynced(String offlineId) async {
    final raw = _b.get(offlineId);
    if (raw != null) {
      await _b.put(offlineId, {...Map<String, dynamic>.from(raw), 'sync_status': 'synced'});
    }
  }

  List<PendingTransaction> getPending() {
    return _b.values
        .map((raw) => PendingTransaction.fromMap(Map<String, dynamic>.from(raw)))
        .where((t) => t.syncStatus == 'pending')
        .toList();
  }

  int get pendingCount => getPending().length;

  Stream<BoxEvent> get changes => _b.watch();
}

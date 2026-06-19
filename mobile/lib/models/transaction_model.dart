class CartItem {
  final String productId;
  final String productName;
  final double unitPrice;
  int quantity;
  final String? photoUrl;

  CartItem({
    required this.productId,
    required this.productName,
    required this.unitPrice,
    this.quantity = 1,
    this.photoUrl,
  });

  double get subtotal => unitPrice * quantity;

  String get formattedSubtotal => 'TZS ${subtotal.toStringAsFixed(0).replaceAllMapped(
    RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'),
    (m) => '${m[1]},',
  )}';

  Map<String, dynamic> toMap() => {
    'product_id':   productId,
    'product_name': productName,
    'unit_price':   unitPrice,
    'quantity':     quantity,
    'photo_url':    photoUrl,
  };

  factory CartItem.fromMap(Map<String, dynamic> map) => CartItem(
    productId:   map['product_id']   as String,
    productName: map['product_name'] as String,
    unitPrice:   (map['unit_price']  as num).toDouble(),
    quantity:    map['quantity']     as int? ?? 1,
    photoUrl:    map['photo_url']    as String?,
  );
}

class PendingTransaction {
  final String offlineId;
  final String shopId;
  final String? staffId;
  final String paymentMethod;
  final double totalAmount;
  final List<CartItem> items;
  final DateTime createdAt;
  String syncStatus;

  PendingTransaction({
    required this.offlineId,
    required this.shopId,
    this.staffId,
    required this.paymentMethod,
    required this.totalAmount,
    required this.items,
    required this.createdAt,
    this.syncStatus = 'pending',
  });

  Map<String, dynamic> toMap() => {
    'offline_id':     offlineId,
    'shop_id':        shopId,
    'staff_id':       staffId,
    'payment_method': paymentMethod,
    'total_amount':   totalAmount,
    'items':          items.map((i) => i.toMap()).toList(),
    'created_at':     createdAt.toIso8601String(),
    'sync_status':    syncStatus,
  };

  factory PendingTransaction.fromMap(Map<String, dynamic> map) => PendingTransaction(
    offlineId:     map['offline_id']     as String,
    shopId:        map['shop_id']        as String,
    staffId:       map['staff_id']       as String?,
    paymentMethod: map['payment_method'] as String,
    totalAmount:   (map['total_amount']  as num).toDouble(),
    items:         (map['items'] as List)
        .map((i) => CartItem.fromMap(Map<String, dynamic>.from(i as Map)))
        .toList(),
    createdAt:     DateTime.parse(map['created_at'] as String),
    syncStatus:    map['sync_status']    as String? ?? 'pending',
  );
}

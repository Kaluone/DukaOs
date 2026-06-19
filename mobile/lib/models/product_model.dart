class ProductModel {
  final String id;
  final String shopId;
  final String name;
  final String? photoUrl;
  final double price;
  final String? category;
  final bool active;
  final int? stockQuantity;
  final int? reorderThreshold;

  const ProductModel({
    required this.id,
    required this.shopId,
    required this.name,
    this.photoUrl,
    required this.price,
    this.category,
    this.active = true,
    this.stockQuantity,
    this.reorderThreshold,
  });

  factory ProductModel.fromMap(Map<String, dynamic> map) {
    final stock = map['stock_levels'];
    final stockMap = stock is Map ? stock : null;
    return ProductModel(
      id:               map['id'] as String,
      shopId:           map['shop_id'] as String,
      name:             map['name'] as String,
      photoUrl:         map['photo_url'] as String?,
      price:            (map['price'] as num).toDouble(),
      category:         map['category'] as String?,
      active:           map['active'] as bool? ?? true,
      stockQuantity:    stockMap?['quantity'] as int?,
      reorderThreshold: stockMap?['reorder_threshold'] as int?,
    );
  }

  Map<String, dynamic> toMap() => {
    'id':        id,
    'shop_id':   shopId,
    'name':      name,
    'photo_url': photoUrl,
    'price':     price,
    'category':  category,
    'active':    active,
  };

  String get formattedPrice => 'TZS ${price.toStringAsFixed(0).replaceAllMapped(
    RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'),
    (m) => '${m[1]},',
  )}';
}

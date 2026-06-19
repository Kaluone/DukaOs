class AppConstants {
  AppConstants._();

  // Spacing (4/8dp rhythm)
  static const double space1 =  4.0;
  static const double space2 =  8.0;
  static const double space3 = 12.0;
  static const double space4 = 16.0;
  static const double space5 = 20.0;
  static const double space6 = 24.0;
  static const double space8 = 32.0;
  static const double space10= 40.0;
  static const double space12= 48.0;

  // Border radius
  static const double radiusS  =  6.0;
  static const double radiusM  = 10.0;
  static const double radiusL  = 14.0;
  static const double radiusXL = 20.0;
  static const double radiusFull = 999.0;

  // Animation durations
  static const Duration animFast   = Duration(milliseconds: 150);
  static const Duration animNormal = Duration(milliseconds: 250);
  static const Duration animSlow   = Duration(milliseconds: 400);

  // Cache TTLs
  static const Duration cacheProducts  = Duration(minutes: 10);
  static const Duration cacheStaff     = Duration(minutes: 10);
  static const Duration cacheDashboard = Duration(seconds: 30);

  // PIN length
  static const int pinMinLength = 4;
  static const int pinMaxLength = 6;

  // Offline queue
  static const String offlineQueueBox = 'offline_transactions';

  // Supabase table names
  static const String tableShops          = 'shops';
  static const String tableStaff          = 'staff';
  static const String tableProducts       = 'products';
  static const String tableStockLevels    = 'stock_levels';
  static const String tableTransactions   = 'transactions';
  static const String tableTxnItems       = 'transaction_items';
  static const String tableReconciliation = 'cash_reconciliations';
}

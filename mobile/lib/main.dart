import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'config/theme.dart';
import 'navigation/app_router.dart';
import 'core/services/offline_queue_service.dart';
import 'core/providers/providers.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);

  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor:           Colors.transparent,
    statusBarIconBrightness:  Brightness.dark,
    statusBarBrightness:      Brightness.light,
  ));

  await Supabase.initialize(
    url:     const String.fromEnvironment('SUPABASE_URL'),
    anonKey: const String.fromEnvironment('SUPABASE_ANON_KEY'),
    authOptions: const FlutterAuthClientOptions(
      authFlowType: AuthFlowType.pkce,
    ),
  );

  // Init Hive and the offline queue BEFORE runApp — no code generation needed.
  await Hive.initFlutter();
  final offlineQueue = OfflineQueueService();
  await offlineQueue.init();

  runApp(
    ProviderScope(
      overrides: [
        // Inject the already-initialised queue so every provider can access it.
        offlineQueueProvider.overrideWithValue(offlineQueue),
      ],
      child: const DukaOsApp(),
    ),
  );
}

class DukaOsApp extends ConsumerStatefulWidget {
  const DukaOsApp({super.key});

  @override
  ConsumerState<DukaOsApp> createState() => _DukaOsAppState();
}

class _DukaOsAppState extends ConsumerState<DukaOsApp>
    with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    // Attempt to drain any offline queue left from the previous session.
    _sync();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  void _sync() =>
      ref.read(transactionServiceProvider).syncPending().ignore();

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) _sync();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title:                    'DukaOS',
      debugShowCheckedModeBanner: false,
      theme:                    AppTheme.light,
      darkTheme:                AppTheme.dark,
      themeMode:                ThemeMode.system,
      routerConfig:             appRouter,
      builder: (context, child) {
        final mq = MediaQuery.of(context);
        return MediaQuery(
          data: mq.copyWith(
            textScaler: TextScaler.linear(
              mq.textScaler.scale(1.0).clamp(0.85, 1.2),
            ),
          ),
          child: child!,
        );
      },
    );
  }
}

---
name: fullstack-blueprint
description: Build production-grade fullstack apps with Next.js (landing page) + React (web app) + Flutter (mobile) + Supabase backend + Snippe payments. Covers architecture, design patterns, UI/UX, auth, caching, performance, testing, error handling, database design, security (OWASP), premium frontend aesthetics, and high-conversion landing pages with Tailwind CSS. Use this skill when creating any new app — SaaS, e-commerce, learning platform, marketplace, dashboard, or any product requiring auth + payments + content management + landing pages.
---

# Fullstack App Blueprint

Build world-class apps using: **Next.js** (landing page) · **React** (web app) · **Flutter** (mobile) · **Supabase** (backend) · **Snippe** (Tanzania payments) · **Tailwind CSS** (landing page styling)

---

## 1. PROJECT STRUCTURE

### React Web App
```
src/
├── app/                    # App shell, providers, router
│   ├── App.tsx
│   ├── router.tsx          # React Router with auth guards
│   └── providers.tsx       # Context providers (auth, theme, query)
├── config/
│   ├── colors.ts           # Design tokens
│   ├── constants.ts        # App-wide constants
│   └── theme.ts            # CSS variables + theme config
├── features/               # Feature-based modules (NOT layer-based)
│   ├── auth/
│   │   ├── components/     # LoginForm, SignupForm, OAuthButton
│   │   ├── hooks/          # useAuth, useSession
│   │   ├── pages/          # LoginPage, SignupPage, ForgotPassword
│   │   └── services/       # authService.ts
│   ├── dashboard/
│   │   ├── components/
│   │   ├── hooks/
│   │   └── pages/
│   ├── payments/
│   │   ├── components/     # PaymentForm, PricingCard
│   │   ├── hooks/          # usePayment, useSubscription
│   │   └── pages/
│   └── [feature-name]/
├── shared/
│   ├── components/         # Button, TextField, Modal, LoadingSpinner
│   ├── hooks/              # useDebounce, useLocalStorage, useMediaQuery
│   ├── layouts/            # DashboardLayout, AuthLayout, PublicLayout
│   ├── lib/                # supabaseClient.ts, api.ts, cache.ts
│   └── types/              # Shared TypeScript interfaces
├── styles/
│   ├── globals.css         # CSS variables, resets, utilities
│   └── animations.css      # Keyframes and transitions
└── main.tsx
```

### Flutter Mobile App
```
lib/
├── config/
│   ├── colors.dart         # AppColors with semantic tokens (NO gradients)
│   ├── constants.dart      # Spacing, radius, animation durations
│   └── theme.dart          # AppTheme.light / AppTheme.dark + TextTheme
├── core/
│   ├── services/           # Split by domain (NOT one god service)
│   │   ├── auth_service.dart
│   │   ├── course_service.dart
│   │   ├── payment_service.dart
│   │   ├── notification_service.dart
│   │   └── cache_service.dart
│   ├── repositories/       # Abstraction over services
│   ├── providers/          # Riverpod providers
│   ├── utils/
│   │   ├── input_sanitizer.dart
│   │   ├── animations.dart
│   │   └── error_handler.dart
│   └── widgets/            # Shared reusable widgets
├── features/               # Feature modules with screens/ + widgets/
│   ├── auth/
│   │   ├── screens/
│   │   └── widgets/
│   └── [feature]/
├── models/                 # Data classes with fromJson/toJson
├── navigation/
│   ├── app_router.dart     # GoRouter with redirect guards
│   └── main_shell.dart     # Shell with sidebar/bottom nav
└── main.dart
```

**RULE: NEVER create a god service file.** Split services by domain. Max 200 lines per service file.

---

## 2. DATABASE DESIGN (Supabase/PostgreSQL)

### Schema Patterns
```sql
-- Always use UUIDs, timestamps, and RLS
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  full_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'user'
    CHECK (role IN ('user', 'admin', 'moderator')),
  has_paid BOOLEAN DEFAULT false,
  subscription_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Many-to-many: use junction tables with cascading deletes
CREATE TABLE public.item_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id UUID REFERENCES items(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  UNIQUE(item_id, category_id)
);

-- Audit logging (automatic via trigger)
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  table_name TEXT,
  record_id TEXT,
  user_id UUID,
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### RLS Rules — MANDATORY on every table
```sql
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own profile"
  ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Anyone can read published items"
  ON public.items FOR SELECT USING (is_published = true);
```

### Database Checklist
- [ ] RLS enabled on ALL tables
- [ ] Foreign keys with ON DELETE CASCADE where appropriate
- [ ] CHECK constraints on enum-like columns
- [ ] Indexes on frequently queried columns (user_id, created_at)
- [ ] Unique constraints on junction tables
- [ ] `updated_at` auto-updated via trigger

### Migration Workflow (Safe Schema Evolution)
```bash
# 1. Make changes locally (Supabase Studio or SQL)
# 2. Generate migration from diff
npx -y supabase db diff -f add_provider_column

# 3. Review the generated file
cat supabase/migrations/*_add_provider_column.sql

# 4. Test locally
npx -y supabase db reset

# 5. Push to production (CAREFUL — irreversible)
npx -y supabase db push --project-ref <project-ref>
```

**Rules:**
- NEVER edit production DB directly — always go through migrations
- Name migrations descriptively: `add_phone_to_payments`, `create_app_config_table`
- Review generated SQL before pushing — `db diff` can miss RLS policies
- After pushing, verify RLS policies are still intact

---

## 3. AUTHENTICATION

### Auth Flow Pattern
```
Splash → Check session → Authenticated?
  ├── YES → Check payment → Paid?
  │     ├── YES → Home
  │     └── NO  → Payment Screen
  └── NO  → Login Screen
```

### Auth Guard (React Router)
```tsx
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <LoadingSpinner />
  if (!user) return <Navigate to="/login" />
  return <>{children}</>
}
```

### Auth Guard (Flutter GoRouter)
```dart
redirect: (context, state) async {
  final isAuthenticated = AuthService.isAuthenticated;
  final isAuthRoute = ['/login', '/signup'].contains(state.matchedLocation);
  final isPaymentRoute = ['/payment', '/payment-success'].contains(state.matchedLocation);
  if (!isAuthenticated && !isAuthRoute) return '/login';
  if (isAuthenticated && isAuthRoute) {
    final paid = await PaymentService.hasCompletedPayment();
    return paid ? '/home' : '/payment';
  }
  if (isAuthenticated && !isPaymentRoute) {
    final paid = await PaymentService.hasCompletedPayment();
    if (!paid) return '/payment';
  }
  return null;
},
```

> **`hasCompletedPayment()`** checks profiles first (cached), then falls back to the `payments` table. If a COMPLETED payment is found but the profile isn't updated, it **self-heals** the profile automatically. See Section 5.

### Auth Checklist
- [ ] Email/password signup with verification
- [ ] Google OAuth (+ Apple for iOS)
- [ ] Forgot password with reset link
- [ ] Session auto-refresh (JWT)
- [ ] Sign-out clears all caches
- [ ] Profile creation on first signup

---

## 4. CACHING & PERFORMANCE

### TTL Cache Pattern
```typescript
// React: shared/lib/cache.ts
class TTLCache<T> {
  private data: T | null = null
  private timestamp: number | null = null
  constructor(private ttlMs: number) {}

  get(forceRefresh = false): T | null {
    if (forceRefresh || !this.data || !this.timestamp) return null
    if (Date.now() - this.timestamp > this.ttlMs) return null
    return this.data
  }
  set(value: T) { this.data = value; this.timestamp = Date.now() }
  invalidate() { this.data = null; this.timestamp = null }
}
```

```dart
// Flutter equivalent
static List<CourseModel>? _cache;
static DateTime? _cacheTime;
static const _cacheTTL = Duration(minutes: 10);

static Future<List<CourseModel>> getCourses({bool forceRefresh = false}) async {
  if (!forceRefresh && _cache != null && _cacheTime != null) {
    if (DateTime.now().difference(_cacheTime!) < _cacheTTL) return _cache!;
  }
  final data = await supabase.from('courses').select();
  _cache = data.map(CourseModel.fromJson).toList();
  _cacheTime = DateTime.now();
  return _cache!;
}
```

### Cache TTL Guidelines
| Data | TTL | Reason |
|------|-----|--------|
| Categories/Tags | 30 min | Rarely change |
| Content lists | 10 min | Changes occasionally |
| User profile | 5 min | User may edit |
| Payment status | 5 min | Critical but expensive |
| Enrollments/Cart | 3 min | Changes on user action |
| App config | Session | Never changes mid-session |

### Cache Rules
1. **Pull-to-refresh ALWAYS bypasses cache** (`forceRefresh: true`)
2. **Data mutations invalidate related cache immediately**
3. **Sign-out clears ALL caches**
4. **Network errors return stale cache** (graceful degradation)

### React: Use TanStack Query
```tsx
function useCourses() {
  return useQuery({
    queryKey: ['courses'],
    queryFn: () => supabase.from('courses').select('*').eq('is_published', true),
    staleTime: 10 * 60 * 1000,
  })
}
```

### Performance Checklist
- [ ] Parallel fetching (`Promise.all` / `Future.wait`)
- [ ] Images: `CachedNetworkImage` (Flutter) or lazy loading (React)
- [ ] Server-side pagination with `.range(from, to)`
- [ ] Debounce search inputs (300ms)
- [ ] Virtualized lists for 50+ items
- [ ] Code splitting / lazy routes (`React.lazy()`)
- [ ] Skeleton loaders instead of spinners
- [ ] `prefers-reduced-motion` respected

---

## 5. PAYMENT INTEGRATION (Snippe — Tanzania Mobile Money)

### Payment Architecture
```
User clicks "Pay" → Edge Function creates Snippe Session → Returns checkout_url
→ App opens URL in browser → User pays on Snippe's page → Snippe sends webhook
→ Webhook verifies + grants subscription → App polls → Self-heals if needed → Home
```

### ⚠️ CRITICAL RULES (Read Before Coding)
1. **Snippe API URL**: `https://api.snippe.sh/api/v1/sessions` (Hosted Checkout)
2. **Auth header**: `Authorization: Bearer <API_KEY>` — NOT `X-API-Key`
3. **Webhook HMAC**: `message = timestamp + '.' + rawBody` (use `node:crypto`)
4. **Flutter Web CORS**: Send user JWT in request body as `access_token`, NOT in Authorization header
5. **Self-healing**: App MUST auto-update profile when COMPLETED payment found (webhook can fail)
6. **Config.toml**: `[functions.X]` name MUST match the actual function directory name

### Edge Function: `snippe-pay` (Checkout Session Creator)
```typescript
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  const { first_name, last_name, phone, access_token } = await req.json();

  // 1. Validate JWT manually (verify_jwt: false for Flutter Web CORS)
  const authRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${access_token}`, apikey: SERVICE_KEY },
  });
  if (!authRes.ok) return json({ error: 'Invalid session' }, 401);
  const user = await authRes.json();

  // 2. Insert PENDING payment
  const ref = `PAY-${user.id.slice(0,8)}-${Date.now().toString(36)}`;
  await supabase.from('payments').insert({
    user_id: user.id, amount: AMOUNT, currency: 'TZS',
    merchant_reference: ref, status: 'PENDING',
  });

  // 3. Create Snippe Hosted Checkout Session
  //    ⚠️ MUST use Authorization: Bearer, NOT X-API-Key
  const res = await fetch('https://api.snippe.sh/api/v1/sessions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SNIPPE_API_KEY}`,
    },
    body: JSON.stringify({
      amount: AMOUNT,
      currency: 'TZS',
      allowed_methods: ['mobile_money', 'card'],
      webhook_url: `${SUPABASE_URL}/functions/v1/snippe-webhook`,
      metadata: { user_id: user.id, reference: ref },
      description: 'Premium Access',
      expires_in: 3600,
    }),
  });

  const data = await res.json();
  // 4. Return checkout_url to Flutter
  return json({ checkout_url: data.data.checkout_url, transaction_id: data.data.reference });
});
```

### Edge Function: `snippe-webhook` (Payment Confirmation)
```typescript
import { createClient } from 'npm:@supabase/supabase-js@2';
import { createHmac, timingSafeEqual } from 'node:crypto';

Deno.serve(async (req: Request) => {
  const rawBody = await req.text();

  // 1. HMAC-SHA256 verification (MANDATORY)
  const timestamp = req.headers.get('x-webhook-timestamp') || '';
  const signature = req.headers.get('x-webhook-signature') || '';
  const message = timestamp + '.' + rawBody;
  const expected = createHmac('sha256', WEBHOOK_SECRET).update(message).digest('hex');
  const sigBuf = Buffer.from(signature, 'hex');
  const expBuf = Buffer.from(expected, 'hex');
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return new Response('Invalid signature', { status: 401 });
  }

  // 2. Replay protection: reject if > 5 minutes old
  if (Math.floor(Date.now() / 1000) - parseInt(timestamp) > 300) {
    return new Response('Timestamp too old', { status: 400 });
  }

  // 3. Parse and process
  const event = JSON.parse(rawBody);
  if (event.type === 'payment.completed') {
    const { user_id } = event.data.metadata;
    const amount = event.data.amount?.value || 0;

    // 4. Amount + currency verification
    if (amount < EXPECTED_AMOUNT) { /* reject */ }

    // 5. Update payment status
    await supabase.from('payments').update({ status: 'COMPLETED' })
      .eq('merchant_reference', event.data.metadata.reference);

    // 6. Grant subscription
    const expiry = new Date(Date.now() + SUBSCRIPTION_DAYS * 86400000);
    await supabase.from('profiles').upsert({
      id: user_id,
      has_paid: true,
      paid_at: new Date().toISOString(),
      subscription_expires_at: expiry.toISOString(),
    });
  }
  return new Response('OK');
});
```

### Flutter: Self-Healing Payment Check (CRITICAL)

**Why self-healing is needed:** The webhook is the primary mechanism for granting access, but it can fail (network issues, signature mismatch, timing races). Without self-healing, users who paid are permanently locked out until manual intervention.

```dart
/// Check payments table for COMPLETED payment.
/// If found but profile not updated → SELF-HEAL by updating profile.
static Future<bool> checkPaymentCompleted() async {
  if (currentUser == null) return false;
  try {
    final response = await client
        .from('payments')
        .select('status, updated_at')
        .eq('user_id', currentUser!.id)
        .eq('status', 'COMPLETED')
        .order('updated_at', ascending: false)
        .limit(1)
        .maybeSingle();
    if (response == null) return false;

    // Self-heal: check if profile needs updating
    final profile = await client
        .from('profiles')
        .select('has_paid')
        .eq('id', currentUser!.id)
        .maybeSingle();

    if (profile == null || profile['has_paid'] != true) {
      // Webhook failed → grant access now
      final expiry = DateTime.now().add(const Duration(days: 60));
      await client.from('profiles').upsert({
        'id': currentUser!.id,
        'has_paid': true,
        'paid_at': DateTime.now().toIso8601String(),
        'subscription_expires_at': expiry.toIso8601String(),
      });
      invalidatePaymentCache();
    }
    return true;
  } catch (e) {
    return false;
  }
}

/// Combined check: profiles first (cached), then payments fallback (self-healing)
static Future<bool> hasCompletedPayment() async {
  invalidatePaymentCache();
  final profilePaid = await hasPaid(); // cached profiles check
  if (profilePaid) return true;
  return await checkPaymentCompleted(); // uncached + self-heal
}
```

### Flutter: Payment Service (SDK Invoke)
```dart
// Use Supabase SDK invoke — handles auth headers correctly:
final response = await Supabase.instance.client.functions.invoke(
  'snippe-pay',
  body: {
    'access_token': freshJwt,  // ⚠️ Send JWT in BODY for Flutter Web
    'first_name': firstName,
    'last_name': lastName,
  },
);
// Extract checkout_url → open in browser:
await launchUrl(Uri.parse(checkoutUrl), mode: LaunchMode.externalApplication);
// Poll hasCompletedPayment() every 5s for up to 5 min
```

### Subscription Lifecycle
```
Day 0:  Webhook sets has_paid=true, subscription_expires_at = now+60d
        (fallback: app self-heals from COMPLETED payment if webhook fails)
Day 1-59: hasPaid() returns true → user accesses all content
Day 60: hasPaid() returns false → GoRouter redirects to /payment
Day 60+: User pays again → new cycle
```

### Supabase Config (config.toml)
```toml
# ⚠️ Function name MUST match directory name
[functions.snippe-pay]
verify_jwt = false

[functions.snippe-webhook]
verify_jwt = false
```

### Payment Pitfalls
| Pitfall | Solution |
|---------|----------|
| `X-API-Key` header for Snippe | Use `Authorization: Bearer <key>` |
| Flutter Web strips Authorization header | Send user JWT in body as `access_token` |
| Webhook fails silently | **Self-healing**: app checks `payments` table and auto-updates profile |
| Stale JWT on retry | Call `refreshSession()` before each attempt |
| Webhook replay attacks | Check timestamp age (< 5 min) |
| Duplicate webhook processing | Store + check `snippe_event_id` |
| Amount tampering | Server-side verify `amount >= expected` AND `currency == expected` |
| `config.toml` name mismatch | `[functions.X]` must match the actual function directory name |
| User stuck on payment screen | `hasCompletedPayment()` with self-healing as fallback to webhook |

### Payment Checklist
- [ ] Edge Function uses `Authorization: Bearer <key>` (NOT `X-API-Key`)
- [ ] Webhook HMAC uses `timestamp + '.' + rawBody` format
- [ ] Replay protection (5-minute window)
- [ ] Idempotency check (`snippe_event_id`)
- [ ] Amount + currency verification server-side
- [ ] Self-healing: `checkPaymentCompleted()` auto-updates profile
- [ ] Router uses `hasCompletedPayment()` (profiles + payments fallback)
- [ ] `config.toml` function names match directory names
- [ ] Webhook sets `subscription_expires_at` (not just `has_paid`)
- [ ] Payment cache invalidated after self-heal

---

## 6. FRONTEND DESIGN — PREMIUM AESTHETICS

### Design Thinking (Before ANY UI Code)
Before coding, commit to a **BOLD aesthetic direction**:
- **Purpose**: What problem does this interface solve? Who uses it?
- **Tone**: Pick a direction — minimalist luxury, playful vibrant, editorial, glassmorphism, brutalist, retro-futuristic, organic/natural, or industrial
- **Differentiation**: What's the ONE thing someone will remember?
- **Constraints**: Framework, performance, accessibility

**CRITICAL**: Choose a clear direction and execute with precision. The key is intentionality, not intensity.

### Design System Tokens (CSS Variables)
```css
:root {
  /* Primary palette — ONE dominant + sharp accent */
  --color-primary: #1a365d;
  --color-primary-light: #2a4a7f;
  --color-accent: #e67e22;

  /* Neutrals */
  --color-bg: #f8f9fa;
  --color-surface: #ffffff;
  --color-text: #1a1a2e;
  --color-text-secondary: #6b7280;

  /* Semantic */
  --color-success: #10b981;
  --color-error: #ef4444;
  --color-warning: #f59e0b;

  /* Typography — always 2 fonts: heading + body */
  --font-heading: 'DM Sans', sans-serif;
  --font-body: 'Plus Jakarta Sans', sans-serif;

  /* Spacing scale (4/8dp rhythm) */
  --space-xs: 4px; --space-s: 8px; --space-m: 16px;
  --space-l: 24px; --space-xl: 32px; --space-xxl: 48px;

  /* Radius */
  --radius-s: 8px; --radius-m: 12px; --radius-l: 16px; --radius-xl: 24px;

  /* Shadows */
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.08);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.1);
  --shadow-lg: 0 8px 30px rgba(0,0,0,0.12);

  /* Transitions */
  --transition-fast: 150ms ease;
  --transition-normal: 250ms ease;
  --transition-slow: 400ms cubic-bezier(0.4,0,0.2,1);
}

/* Dark mode — desaturated tonal variants, NOT inverted */
:root[data-theme="dark"] {
  --color-primary: #3b82f6;
  --color-primary-light: #60a5fa;
  --color-accent: #f59e0b;
  --color-bg: #0f172a;
  --color-surface: #1e293b;
  --color-text: #f1f5f9;
  --color-text-secondary: #94a3b8;
  --color-success: #34d399;
  --color-error: #f87171;
  --color-warning: #fbbf24;
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.3);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.4);
  --shadow-lg: 0 8px 30px rgba(0,0,0,0.5);
}
```

### Flutter Design Tokens (AppColors + AppTheme)
```dart
// config/colors.dart
import 'package:flutter/material.dart';

class AppColors {
  // Primary palette
  static const primary = Color(0xFF1A365D);
  static const primaryLight = Color(0xFF2A4A7F);
  static const accent = Color(0xFFE67E22);
  static const accentSecondary = Color(0xFF48BB78);

  // Neutrals
  static const background = Color(0xFFF7F8FC);
  static const surface = Color(0xFFFFFFFF);
  static const textPrimary = Color(0xFF1A202C);
  static const textSecondary = Color(0xFF718096);

  // Semantic
  static const success = Color(0xFF10B981);
  static const error = Color(0xFFE53E3E);
  static const warning = Color(0xFFF59E0B);

  // Dark mode variants
  static const darkBackground = Color(0xFF0F172A);
  static const darkSurface = Color(0xFF1E293B);
  static const darkTextPrimary = Color(0xFFF1F5F9);
  static const darkTextSecondary = Color(0xFF94A3B8);
}

// config/theme.dart
class AppTheme {
  static ThemeData get light => ThemeData(
    brightness: Brightness.light,
    scaffoldBackgroundColor: AppColors.background,
    colorScheme: ColorScheme.light(
      primary: AppColors.primary,
      secondary: AppColors.accent,
      surface: AppColors.surface,
      error: AppColors.error,
    ),
    textTheme: _textTheme(AppColors.textPrimary, AppColors.textSecondary),
    appBarTheme: const AppBarTheme(
      backgroundColor: Colors.transparent,
      elevation: 0,
      foregroundColor: AppColors.textPrimary,
    ),
  );

  static ThemeData get dark => ThemeData(
    brightness: Brightness.dark,
    scaffoldBackgroundColor: AppColors.darkBackground,
    colorScheme: ColorScheme.dark(
      primary: AppColors.primaryLight,
      secondary: AppColors.accent,
      surface: AppColors.darkSurface,
      error: AppColors.error,
    ),
    textTheme: _textTheme(AppColors.darkTextPrimary, AppColors.darkTextSecondary),
  );

  static TextTheme _textTheme(Color primary, Color secondary) => TextTheme(
    headlineLarge: GoogleFonts.dmSans(fontSize: 32, fontWeight: FontWeight.w800, color: primary),
    headlineMedium: GoogleFonts.dmSans(fontSize: 24, fontWeight: FontWeight.w700, color: primary),
    headlineSmall: GoogleFonts.dmSans(fontSize: 18, fontWeight: FontWeight.w600, color: primary),
    bodyLarge: GoogleFonts.plusJakartaSans(fontSize: 16, fontWeight: FontWeight.w400, color: primary),
    bodyMedium: GoogleFonts.plusJakartaSans(fontSize: 14, fontWeight: FontWeight.w400, color: secondary),
    labelLarge: GoogleFonts.plusJakartaSans(fontSize: 14, fontWeight: FontWeight.w600, color: primary),
  );
}
```

### Typography Rules
- **NEVER use Inter, Roboto, Arial, or system fonts** — these are banned. Always use distinctive, curated fonts (e.g., DM Sans, Plus Jakarta Sans, Space Grotesk, Outfit, Sora, Clash Display, Satoshi, General Sans)
- Pair a distinctive display font with a refined body font
- Base body: 16px, line-height: 1.5–1.75
- Max line length: 65–75 characters
- Consistent type scale: 12, 14, 16, 18, 24, 32

### Color Rules
- **NO GRADIENT COLORS** — use solid, flat colors only. No linear-gradient, radial-gradient, or gradient meshes anywhere
- Dominant color with sharp accents > evenly-distributed palettes
- Define semantic tokens (primary, error, surface) — never raw hex in components
- Dark mode: desaturated/lighter tonal variants, NOT inverted colors
- Test contrast independently: text ≥4.5:1 (WCAG AA)

### Icon Color Rules
- **ONE COLOR PER ICON SET** — never mix multiple colors across icon groups in the same section
- All feature/category icons MUST use the same color (typically `primary` or `primary-light`)
- Use the app's primary dark blue for icon grids, feature cards, and category cards
- Multi-colored icons look amateurish and inconsistent — always unify
- Exception: semantic icons (success ✓ green, error ✗ red) can differ for status indicators only

### Motion & Animation
- Duration: 150–300ms micro-interactions, ≤400ms complex transitions
- Use `transform`/`opacity` only — never animate `width`/`height`/`top`/`left`
- Ease-out for entering, ease-in for exiting, spring physics for natural feel
- Exit animations: 60–70% of enter duration
- Stagger list items: 30–50ms per item
- **Always** respect `prefers-reduced-motion`
- Max 1–2 animated elements per view

### Glassmorphism Pattern (for auth, modals)
```css
.glass-card {
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: var(--radius-l);
}
```

### Visual Details That Elevate
- Noise textures, geometric patterns, solid-color overlays
- Layered transparencies, dramatic shadows
- Custom hover states that surprise (scale 0.95–1.05 on press)
- Skeleton loaders for content areas (not spinners)
- Empty states: illustration + message + CTA button
- Error states: inline with recovery action, never just "Error"

### NEVER Do This
- **NO EMOJI** — never use emoji anywhere (UI, labels, headings, toasts, empty states). Use SVG icons only (Lucide, Heroicons, Material Symbols)
- **NO GRADIENTS** — no gradient backgrounds, gradient text, gradient borders, or any CSS gradient. Use solid colors exclusively
- **NO MULTI-COLORED ICON GRIDS** — never assign different colors to icons in the same section (features, courses, etc.). Use ONE unified color
- Cookie-cutter layouts with no personality
- Placeholder-only labels on form fields
- Same design across every project — vary themes/fonts/aesthetics

---

## 7. UI/UX QUALITY RULES (Priority Order)

### Priority 1: Accessibility (CRITICAL)
- Contrast: 4.5:1 normal text, 3:1 large text
- Visible focus rings (2–4px) on all interactive elements
- `aria-label` for icon-only buttons
- Tab order matches visual order
- `alt` text on meaningful images
- Support `prefers-reduced-motion` and dynamic text scaling
- Color is never the only indicator (add icon/text)

### Priority 2: Touch & Interaction (CRITICAL)
- Min touch target: 44×44pt (iOS) / 48×48dp (Android)
- 8px+ spacing between targets
- Tap feedback within 100ms (ripple/opacity/scale)
- Don't rely on hover alone — use click/tap
- Disable buttons during async, show spinner
- Error messages near the problem field

### Priority 3: Layout & Responsive (HIGH)
- Mobile-first, breakpoints: 375 / 768 / 1024 / 1440
- Never disable viewport zoom
- No horizontal scroll on mobile
- 4/8dp spacing rhythm everywhere
- Safe area compliance (notch, gesture bars)
- Max content width on desktop (1200–1440px)

### Priority 4: Forms & Feedback (MEDIUM)
- Visible labels per input (not placeholder-only)
- Validate on blur, not keystroke
- Error below field with cause + how to fix
- Required field indicators (asterisk)
- Multi-step: show progress bar, allow back
- Auto-dismiss toasts in 3–5s
- Confirm before destructive actions

### Priority 5: Navigation (HIGH)
- Bottom nav: max 5 items with labels + icons
- Back behavior: predictable, preserves scroll/state
- All key screens reachable via deep link/URL
- Current location highlighted in nav
- Sidebar for desktop (≥1024px), bottom nav for mobile
- Modals: always have close affordance

### Flutter Bottom Navigation: `curved_navigation_bar` (PREFERRED)
Use the `curved_navigation_bar` package for a premium animated bottom nav with a signature curved bump effect.

**Install:**
```yaml
dependencies:
  curved_navigation_bar: ^1.0.6
```

**Integration with GoRouter ShellRoute:**
```dart
import 'package:curved_navigation_bar/curved_navigation_bar.dart';

class MainShell extends StatefulWidget {
  final Widget child;
  const MainShell({super.key, required this.child});

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  final _navKey = GlobalKey<CurvedNavigationBarState>();

  // Map routes to tab indices
  static const _routes = ['/home', '/my-courses', '/profile'];

  int _currentIndex(BuildContext context) {
    final location = GoRouterState.of(context).matchedLocation;
    final idx = _routes.indexOf(location);
    return idx >= 0 ? idx : 0;
  }

  void _onTap(int index) {
    if (index < _routes.length) {
      context.go(_routes[index]);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDesktop = MediaQuery.of(context).size.width > 800;

    // Desktop: use sidebar instead (see sidebar pattern)
    if (isDesktop) return _buildDesktopLayout();

    return Scaffold(
      body: widget.child,
      bottomNavigationBar: CurvedNavigationBar(
        key: _navKey,
        index: _currentIndex(context),
        height: 60,
        color: Colors.white,                    // Bar color
        buttonBackgroundColor: Colors.white,    // Floating button color
        backgroundColor: Colors.transparent,    // Must match page bg or use transparent
        animationDuration: const Duration(milliseconds: 400),
        animationCurve: Curves.easeOutCubic,
        items: const <Widget>[
          Icon(Icons.home_rounded, size: 26, color: Color(0xFF1565C0)),
          Icon(Icons.menu_book_rounded, size: 26, color: Color(0xFF1565C0)),
          Icon(Icons.person_rounded, size: 26, color: Color(0xFF1565C0)),
        ],
        onTap: _onTap,
      ),
    );
  }
}
```

**Key Properties:**
| Property | Default | Purpose |
|---|---|---|
| `items` | required | List of icon widgets (max 5) |
| `index` | 0 | Current/initial selected tab |
| `color` | white | Bar background color |
| `buttonBackgroundColor` | same as color | Floating circle button color |
| `backgroundColor` | blueAccent | Must match page bg or use transparent |
| `height` | 75 | Bar height (0–75) |
| `animationDuration` | 600ms | Tab switch animation speed |
| `animationCurve` | easeOutCubic | Animation easing curve |
| `letIndexChange` | `(_) => true` | Gate function to block tab switches |

**Rules:**
- Always sync `index` with GoRouter's current location
- Use `backgroundColor: Colors.transparent` to avoid color mismatch with page backgrounds
- Keep `height` between 55–65 for comfortable touch targets
- Max 5 items — use sidebar for more destinations on desktop

### React Bottom Navigation: Curved Nav Bar (Custom Component)
No npm package needed — build it with pure CSS + SVG. Replicates the Flutter `curved_navigation_bar` effect.

**Component: `CurvedNavBar.tsx`**
```tsx
import { useState, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import './CurvedNavBar.css'

interface NavItem {
  icon: React.ReactNode
  label: string
  path: string
}

interface CurvedNavBarProps {
  items: NavItem[]
  color?: string            // Bar color
  activeColor?: string      // Floating button accent
  bgColor?: string          // Page background (for SVG curve fill)
}

export function CurvedNavBar({
  items,
  color = '#ffffff',
  activeColor = '#1565C0',
  bgColor = '#f8f9fa',
}: CurvedNavBarProps) {
  const navigate = useNavigate()
  const location = useLocation()

  const activeIndex = items.findIndex((item) => location.pathname === item.path)
  const current = activeIndex >= 0 ? activeIndex : 0
  const itemWidth = 100 / items.length

  const handleTap = useCallback(
    (index: number) => {
      navigate(items[index].path)
    },
    [items, navigate],
  )

  // SVG curve centered on active item
  const curveCenter = itemWidth * current + itemWidth / 2

  return (
    <nav className="curved-nav" style={{ '--bar-color': color, '--bg-color': bgColor } as React.CSSProperties}>
      {/* SVG curve notch */}
      <svg className="curved-nav__curve" viewBox="0 0 100 16" preserveAspectRatio="none">
        <path
          d={`
            M 0 16
            L ${curveCenter - 12} 16
            Q ${curveCenter - 6} 16, ${curveCenter - 4} 10
            Q ${curveCenter} -2, ${curveCenter + 4} 10
            Q ${curveCenter + 6} 16, ${curveCenter + 12} 16
            L 100 16
            L 100 16 L 0 16 Z
          `}
          fill={color}
          className="curved-nav__path"
        />
      </svg>

      {/* Bar body */}
      <div className="curved-nav__bar" style={{ backgroundColor: color }}>
        {items.map((item, index) => {
          const isActive = index === current
          return (
            <button
              key={item.path}
              className={`curved-nav__item ${isActive ? 'curved-nav__item--active' : ''}`}
              onClick={() => handleTap(index)}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
            >
              <span
                className="curved-nav__icon"
                style={isActive ? { backgroundColor: activeColor, color: '#fff' } : {}}
              >
                {item.icon}
              </span>
              {!isActive && <span className="curved-nav__label">{item.label}</span>}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
```

**Styles: `CurvedNavBar.css`**
```css
.curved-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 100;
  height: 70px;
  pointer-events: none;
}

.curved-nav__curve {
  position: absolute;
  top: -15px;
  left: 0;
  width: 100%;
  height: 16px;
  pointer-events: none;
}

.curved-nav__path {
  transition: d 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.curved-nav__bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: space-around;
  padding: 0 8px;
  pointer-events: auto;
  box-shadow: 0 -2px 12px rgba(0, 0, 0, 0.06);
}

.curved-nav__item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  flex: 1;
  border: none;
  background: none;
  cursor: pointer;
  padding: 4px 0;
  -webkit-tap-highlight-color: transparent;
  transition: transform 0.15s ease;
}

.curved-nav__item:active {
  transform: scale(0.92);
}

.curved-nav__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  color: #6b7280;
}

.curved-nav__item--active .curved-nav__icon {
  transform: translateY(-28px);
  width: 50px;
  height: 50px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}

.curved-nav__label {
  font-size: 10px;
  font-weight: 500;
  color: #6b7280;
  transition: opacity 0.2s ease;
}

@media (prefers-reduced-motion: reduce) {
  .curved-nav__path,
  .curved-nav__icon {
    transition: none;
  }
}
```

**Usage with React Router:**
```tsx
import { Home, BookOpen, User } from 'lucide-react'

function App() {
  return (
    <>
      <Outlet />
      <CurvedNavBar
        items={[
          { icon: <Home size={22} />, label: 'Home', path: '/home' },
          { icon: <BookOpen size={22} />, label: 'Courses', path: '/courses' },
          { icon: <User size={22} />, label: 'Profile', path: '/profile' },
        ]}
        color="#ffffff"
        activeColor="#1565C0"
      />
    </>
  )
}
```

**React Curved Nav Rules:**
- SVG `d` path transitions for smooth curve movement
- Active icon floats up via `translateY(-28px)` with a circular background
- Use `position: fixed` so it stays above page content
- Add `padding-bottom: 80px` to page content to avoid overlap
- Hide on desktop (≥1024px) — use sidebar instead

---

## 8. SECURITY (OWASP + Supabase)

### Express.js Security (React Web API)
```typescript
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://*.supabase.co"],
    }
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true }
}))

// Rate limit: 100 req/15min general, 5 req/15min auth
const limiter = rateLimit({ windowMs: 15*60*1000, max: 100 })
const authLimiter = rateLimit({ windowMs: 15*60*1000, max: 5, skipSuccessfulRequests: true })
app.use('/api/', limiter)
app.use('/api/auth/login', authLimiter)
```

### Input Validation
```typescript
import Joi from 'joi'
const userSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).pattern(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)/).required(),
  name: Joi.string().min(2).max(50).required()
})
// Always: parameterized queries, DOMPurify for user HTML
```

### Security Checklist
- [ ] HTTPS enforced in production
- [ ] Environment variables for ALL secrets (never hardcode)
- [ ] RLS on every Supabase table
- [ ] Input sanitization (XSS prevention)
- [ ] Parameterized queries (SQL injection prevention)
- [ ] HMAC verification on webhooks
- [ ] User-scoped storage paths (`{user_id}/filename`)
- [ ] Rate limiting on auth endpoints
- [ ] CORS: production domains only
- [ ] JWT validation in Edge Functions
- [ ] File upload validation (type + size)
- [ ] No `eval()`, no direct `innerHTML`
- [ ] CSRF protection on state-changing endpoints
- [ ] `npm audit` / dependency scanning regular

### OWASP Top 10 Checklist
- [ ] A01: Broken Access Control → RLS + RBAC
- [ ] A02: Cryptographic Failures → HTTPS + encryption
- [ ] A03: Injection → Parameterized queries + validation
- [ ] A04: Insecure Design → Security by design
- [ ] A05: Security Misconfiguration → Helmet + defaults
- [ ] A06: Vulnerable Components → `npm audit` regularly
- [ ] A07: Auth Failures → Strong auth + rate limiting
- [ ] A08: Data Integrity → HMAC + CSRF prevention
- [ ] A09: Logging Failures → Audit logs on sensitive ops
- [ ] A10: SSRF → Validate outbound requests

---

## 9. ERROR HANDLING (Never Silently Swallow)

### React Error Pattern
```typescript
class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public userMessage: string,
    public retryable: boolean = false
  ) { super(message) }
}

async function safeFetch<T>(fn: () => Promise<T>, fallback: T, context: string): Promise<T> {
  try { return await fn() }
  catch (error) {
    console.error(`[${context}]`, error)
    errorReporter.capture(error, { context })
    return fallback
  }
}
```

### Flutter Error Pattern
```dart
class AppError {
  final String message;
  final String userMessage;
  final bool retryable;
  AppError(this.message, {this.userMessage = 'Something went wrong', this.retryable = false});
}
```

### Error Code Mapping (Supabase + Snippe → User Messages)

Map raw backend errors to user-friendly messages. Adapt language to your app's locale.

| Error Source | Code / Pattern | User Message (Swahili example) | Retryable? |
|---|---|---|:---:|
| Supabase Auth | `invalid_credentials` | "Barua pepe au nenosiri si sahihi" | No |
| Supabase Auth | `email_not_confirmed` | "Tafadhali thibitisha barua pepe yako kwanza" | No |
| Supabase Auth | `user_already_exists` | "Akaunti hii tayari ipo. Jaribu kuingia" | No |
| Supabase Auth | `over_request_rate_limit` | "Majaribio mengi. Subiri dakika chache" | Yes |
| Supabase DB | `PGRST116` (no rows) | "Hakuna data iliyopatikana" | No |
| Supabase DB | `23505` (unique violation) | "Rekodi hii tayari ipo" | No |
| Supabase DB | `42501` (RLS denied) | "Huna ruhusa ya kufanya hivi" | No |
| Network | `SocketException` / `Failed to fetch` | "Hakuna mtandao. Jaribu tena" | Yes |
| Network | `TimeoutException` | "Mfumo umechukua muda mrefu. Jaribu tena" | Yes |
| Snippe | `502` / `503` | "Mfumo wa malipo haupatikani kwa sasa" | Yes |
| Snippe | `missing authorization` | "Tatizo la uthibitisho. Ingia tena" | No |
| Generic | Any unhandled | "Hitilafu imetokea. Jaribu tena baadaye" | Yes |

```dart
/// Map raw errors to user-friendly AppError
static AppError mapError(dynamic error) {
  final msg = error.toString().toLowerCase();
  if (msg.contains('socketexception') || msg.contains('failed to fetch'))
    return AppError(msg, userMessage: 'Hakuna mtandao. Jaribu tena', retryable: true);
  if (msg.contains('invalid_credentials'))
    return AppError(msg, userMessage: 'Barua pepe au nenosiri si sahihi');
  if (msg.contains('502') || msg.contains('503'))
    return AppError(msg, userMessage: 'Mfumo haupatikani kwa sasa', retryable: true);
  return AppError(msg, userMessage: 'Hitilafu imetokea. Jaribu tena', retryable: true);
}
```

### Retry with Exponential Backoff (Reusable Utility)

```dart
/// Flutter: retry with exponential backoff
static Future<T> retryWithBackoff<T>({
  required Future<T> Function() action,
  int maxAttempts = 5,
  Duration initialDelay = const Duration(seconds: 1),
  bool Function(Exception)? shouldRetry,
}) async {
  Exception? lastError;
  for (int attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await action();
    } catch (e) {
      lastError = e is Exception ? e : Exception(e.toString());
      final retry = shouldRetry?.call(lastError) ?? _isRetryable(lastError);
      if (!retry || attempt == maxAttempts) throw lastError;
      final delay = initialDelay * (1 << (attempt - 1)); // 1s, 2s, 4s, 8s...
      await Future.delayed(delay);
    }
  }
  throw lastError!;
}

static bool _isRetryable(Exception e) {
  final msg = e.toString().toLowerCase();
  return msg.contains('502') || msg.contains('503') ||
         msg.contains('timeout') || msg.contains('socket');
}
```

```typescript
// React/TypeScript equivalent
async function retryWithBackoff<T>(
  action: () => Promise<T>,
  maxAttempts = 5,
  initialDelayMs = 1000
): Promise<T> {
  let lastError: Error | undefined
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try { return await action() }
    catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e))
      const msg = lastError.message.toLowerCase()
      const retryable = msg.includes('502') || msg.includes('503') || msg.includes('fetch')
      if (!retryable || attempt === maxAttempts) throw lastError
      await new Promise(r => setTimeout(r, initialDelayMs * (1 << (attempt - 1))))
    }
  }
  throw lastError!
}
```

### Error Rules
1. **NEVER** `catch (e) { return []; }` — always log + report
2. Show user-friendly messages via `mapError()`, not raw exceptions
3. Add retry button for `retryable: true` errors
4. Return stale cache on failure (graceful degradation)
5. Wire all catches to Crashlytics/Sentry in production
6. Use `retryWithBackoff()` for all network calls to payment APIs

---

## 10. STATE MANAGEMENT

### React: TanStack Query + Zustand
```tsx
// Server state → TanStack Query
// Client state → Zustand
import { create } from 'zustand'
interface AppStore {
  sidebarOpen: boolean
  toggleSidebar: () => void
}
export const useAppStore = create<AppStore>((set) => ({
  sidebarOpen: true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
}))
```

### Flutter: Riverpod
```dart
final coursesProvider = FutureProvider<List<CourseModel>>((ref) async {
  return ref.read(courseServiceProvider).getCourses();
});
```

### Rules
- Server state (API data) → TanStack Query / FutureProvider
- Client state (UI toggles) → Zustand / StateNotifier
- Auth state → Context/Provider at app root
- NEVER duplicate state across screens

---

## 11. TESTING (Production-Ready)

### Critical Paths to Test
1. Auth: signup → verify → login → logout
2. Payment: initiate → webhook → access granted
3. **Payment self-healing: webhook fails → app detects COMPLETED payment → auto-grants access**
4. Caching: cache hit → miss → error fallback
5. Guards: unauthenticated redirect, unpaid redirect, self-heal redirect

### Test Structure
```
test/
├── services/
│   ├── payment_service_test.dart    # Payment logic unit tests
│   └── supabase_service_test.dart   # DB operations unit tests
├── widgets/
│   └── payment_screen_test.dart     # Widget render + interaction tests
├── mocks/
│   └── mock_supabase.dart           # Shared mock Supabase client
└── e2e/
    └── payment_flow_test.dart       # Full payment E2E
```

### Flutter: Mock Supabase Client
```dart
// test/mocks/mock_supabase.dart
import 'package:mockito/annotations.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

@GenerateMocks([SupabaseClient, GoTrueClient, SupabaseQueryBuilder])
import 'mock_supabase.mocks.dart';

/// Create a mock client that returns predictable data
MockSupabaseClient createMockClient({
  bool hasPaid = false,
  bool hasCompletedPayment = false,
}) {
  final client = MockSupabaseClient();
  final auth = MockGoTrueClient();
  final query = MockSupabaseQueryBuilder();

  when(client.auth).thenReturn(auth);
  when(auth.currentUser).thenReturn(User(
    id: 'test-user-123', email: 'test@example.com',
    appMetadata: {}, userMetadata: {},
    aud: 'authenticated', createdAt: DateTime.now().toIso8601String(),
  ));

  // Mock profiles query
  when(client.from('profiles')).thenReturn(query);
  // Configure query chain for has_paid check...
  return client;
}
```

### Flutter: Payment Service Unit Test
```dart
// test/services/payment_service_test.dart
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('PaymentService', () {
    test('hasPaid returns true when profile has_paid=true and not expired', () async {
      // Arrange: mock profiles table to return has_paid=true, future expiry
      final client = createMockClient(hasPaid: true);

      // Act
      final result = await PaymentService.hasPaid();

      // Assert
      expect(result, isTrue);
    });

    test('hasPaid returns false when subscription expired', () async {
      // Arrange: mock with past subscription_expires_at
      final client = createMockClient(hasPaid: true);
      // Override expiry to past date...

      final result = await PaymentService.hasPaid();
      expect(result, isFalse);
    });

    test('self-healing: grants access when COMPLETED payment exists but profile not updated', () async {
      // Arrange: profile has_paid=false, but payments table has COMPLETED row
      final client = createMockClient(hasPaid: false, hasCompletedPayment: true);

      // Act
      final result = await PaymentService.hasCompletedPayment();

      // Assert: should return true AND update profile
      expect(result, isTrue);
      // Verify upsert was called with has_paid=true
      verify(client.from('profiles').upsert(argThat(
        containsPair('has_paid', true),
      ))).called(1);
    });

    test('retryWithBackoff retries on 502 and succeeds', () async {
      int attempts = 0;
      final result = await retryWithBackoff(
        action: () async {
          attempts++;
          if (attempts < 3) throw Exception('502 Bad Gateway');
          return 'success';
        },
        maxAttempts: 5,
        initialDelay: Duration(milliseconds: 10), // Fast for tests
      );
      expect(result, equals('success'));
      expect(attempts, equals(3));
    });
  });
}
```

### Flutter: Widget Test (Payment Screen)
```dart
// test/widgets/payment_screen_test.dart
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter/material.dart';

void main() {
  testWidgets('Payment screen shows price and CTA button', (tester) async {
    await tester.pumpWidget(MaterialApp(home: PaymentScreen()));
    await tester.pumpAndSettle();

    // Verify price is displayed
    expect(find.textContaining('20,000'), findsOneWidget);
    // Verify CTA button exists
    expect(find.text('Lipa Sasa'), findsOneWidget);
  });

  testWidgets('Nimeshalipia button triggers payment check', (tester) async {
    await tester.pumpWidget(MaterialApp(home: PaymentScreen()));
    await tester.pumpAndSettle();

    // Tap "I have already paid" button
    await tester.tap(find.text('Nimeshalipia'));
    await tester.pump();

    // Should show loading indicator
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
  });
}
```

### E2E Test Skeleton (Integration)
```dart
// test/e2e/payment_flow_test.dart
import 'package:integration_test/integration_test.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('Full payment flow: login → pay → access', (tester) async {
    // 1. Launch app
    app.main();
    await tester.pumpAndSettle();

    // 2. Login
    await tester.enterText(find.byKey(Key('email_field')), 'test@example.com');
    await tester.enterText(find.byKey(Key('password_field')), 'TestPass123');
    await tester.tap(find.byKey(Key('login_button')));
    await tester.pumpAndSettle(Duration(seconds: 3));

    // 3. Should be on payment screen (unpaid user)
    expect(find.text('Lipa Sasa'), findsOneWidget);

    // 4. Simulate payment completion (via test helper)
    // ... inject COMPLETED payment into test DB ...

    // 5. Tap "Nimeshalipia" to trigger self-healing
    await tester.tap(find.text('Nimeshalipia'));
    await tester.pumpAndSettle(Duration(seconds: 5));

    // 6. Should be redirected to home
    expect(find.text('Home'), findsOneWidget);
  });
}
```

### Testing Checklist
- [ ] Mock Supabase client (never hit real DB in unit tests)
- [ ] Test happy path + error path for every service method
- [ ] Test self-healing: COMPLETED payment + stale profile → auto-fix
- [ ] Test retry logic: verify exponential backoff timing
- [ ] Test router guards: unauthenticated → login, unpaid → payment
- [ ] Widget tests: verify UI renders correct states (loading, error, success)
- [ ] E2E: full auth → payment → content access flow

---

## 12. DEPLOYMENT

### Landing Page (Next.js) → Netlify (Recommended)
```bash
# Deploy via GitHub → Netlify Dashboard (NOT CLI — avoids Windows path issues)
# 1. Push to GitHub
# 2. Netlify → "Add new site" → "Import from Git"
# 3. Netlify auto-detects netlify.toml
# 4. Add env vars: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
# 5. Deploy — Netlify builds in Linux cloud environment
```

**Domain Architecture (same domain for landing page + app):**
```
ujuzikidigitali.com          → Next.js Landing Page (Netlify)
app.ujuzikidigitali.com      → Flutter Web App (Netlify)
```
- Root domain serves the landing page (SEO, marketing)
- `app.` subdomain serves the Flutter web app (no extra cost)
- All landing page CTAs link to `https://app.yourdomain.com/#/login`
- DNS: A record for root → Netlify, CNAME `app` → Flutter Netlify URL

**⚠️ NEVER deploy Next.js via Netlify CLI on Windows** — use GitHub integration only. Local CLI builds cause Windows path issues in Netlify Functions.

### React Web App → Vercel/Netlify
```bash
npm run build
# Env vars: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
```

### Flutter Mobile → App/Play Store
```bash
flutter run -d chrome --dart-define=SUPABASE_URL=... --dart-define=SUPABASE_ANON_KEY=...
flutter build apk --dart-define=SUPABASE_URL=... --dart-define=SUPABASE_ANON_KEY=...
```

---

## 13. PRE-DELIVERY CHECKLIST

### Visual Quality
- [ ] **No emoji anywhere** — all icons are SVG (Lucide, Heroicons, Material Symbols)
- [ ] **No gradient colors** — all colors are solid/flat, zero CSS gradients
- [ ] Consistent icon family and style
- [ ] Semantic theme tokens (no hardcoded hex)
- [ ] Pressed states don't shift layout

### Interaction
- [ ] All tappable elements: clear press feedback
- [ ] Touch targets ≥44pt / ≥48dp
- [ ] Micro-interactions: 150–300ms with natural easing
- [ ] Disabled states: visually clear + non-interactive
- [ ] Screen reader labels on all interactive elements

### Light/Dark Mode
- [ ] Primary text contrast ≥4.5:1 in both modes
- [ ] Borders/dividers visible in both modes
- [ ] Both themes tested before delivery

### Layout
- [ ] Safe areas respected (notch, gesture bars)
- [ ] Scroll content not hidden behind fixed bars
- [ ] Tested: small phone, large phone, tablet, desktop
- [ ] 4/8dp spacing rhythm maintained

### Security
- [ ] No secrets in client code
- [ ] RLS on all tables
- [ ] Webhook signatures verified
- [ ] Rate limiting active on auth routes

---

## 14. QUICK START (New App)

1. [ ] **Database**: Schema → Migrations → RLS → Indexes
2. [ ] **Auth**: Supabase Auth → OAuth → Profile trigger
3. [ ] **Design system**: Colors, fonts, spacing tokens
4. [ ] **Structure**: Feature folders with screens + components
5. [ ] **Router**: Auth guards + payment gates
6. [ ] **Services**: One per domain (max 200 lines each)
7. [ ] **Caching**: TTL cache on all read operations
8. [ ] **Error handling**: AppError class + reporter
9. [ ] **Payment**: Edge Functions + webhook HMAC
10. [ ] **Testing**: Auth + payment critical paths
11. [ ] **Security**: OWASP checklist pass
12. [ ] **Landing page**: Next.js + Tailwind CSS → Netlify
13. [ ] **Deploy**: Env vars → Build → Ship

---

## 15. LANDING PAGE (Next.js 15 + Tailwind CSS)

### Architecture
```
landing-page/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── layout.js           # Root layout with fonts + metadata
│   │   ├── page.js             # Home page (server component — fetches stats)
│   │   ├── globals.css         # Tailwind + design tokens
│   │   ├── favicon.ico         # App favicon (same as Flutter app)
│   │   ├── privacy-policy/     # Static legal pages
│   │   │   └── page.js
│   │   ├── terms-of-use/
│   │   │   └── page.js
│   │   └── help-support/
│   │       └── page.js
│   └── components/             # Section components
│       ├── Navbar.js           # Sticky nav with mobile drawer
│       ├── Hero.js             # Hero with animated counters
│       ├── Features.js         # Feature grid (6 cards)
│       ├── HowItWorks.js       # Step-by-step flow
│       ├── CoursesPreview.js   # Course category cards
│       ├── Pricing.js          # Pricing card with CTA
│       ├── Testimonials.js     # Social proof cards
│       ├── AboutUs.js          # Mission + values
│       ├── FAQ.js              # Accordion
│       ├── CTABanner.js        # Final conversion CTA
│       ├── Footer.js           # Links + social media
│       └── ScrollReveal.js     # Intersection Observer animation wrapper
├── public/
│   └── images/                 # Hero image, logo
├── netlify.toml                # Netlify build config
├── tailwind.config.js          # Tailwind theme extending app tokens
└── .env.local                  # NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
```

### Tailwind CSS Setup
```js
// tailwind.config.js — extend with your app's design tokens
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#1A3A5C', light: '#2B6CB0' },
        accent: { DEFAULT: '#F6AD55', secondary: '#48BB78' },
      },
      fontFamily: {
        heading: ['DM Sans', 'sans-serif'],
        body: ['Plus Jakarta Sans', 'sans-serif'],
      },
    },
  },
}
```

### Dynamic Stats from Supabase (Server Component)
```sql
-- Create a Supabase function for landing page stats
CREATE OR REPLACE FUNCTION public.get_landing_stats()
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN json_build_object(
    'courses', (SELECT count(*) FROM courses),
    'learners', (SELECT count(*) FROM profiles WHERE has_paid = true),
    'quizzes', (SELECT count(*) FROM quizzes),
    'certificates', (SELECT count(*) FROM issued_certificates)
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_landing_stats() TO anon;
```

```js
// page.js — server component fetches stats via Supabase REST API (no SDK needed)
async function getStats() {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/get_landing_stats`,
      {
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        next: { revalidate: 60 }, // Refresh every 60 seconds
      }
    );
    return await res.json();
  } catch { return { courses: 5, learners: 34, quizzes: 11, certificates: 11 }; }
}
```

### Landing Page Sections (10 required)
1. **Navbar** — Sticky, transparent-to-solid on scroll, mobile hamburger drawer
2. **Hero** — Background image, headline, 2 CTAs (Get Started + Explore), animated stat counters
3. **Features** — 6-card grid with SVG icons (ALL same color), staggered reveal
4. **How It Works** — 4-step numbered flow
5. **Courses Preview** — Category cards with course counts (ALL icons same color)
6. **Pricing** — Single pricing card with feature list + payment methods
7. **Testimonials** — 3 persona cards with quotes
8. **About Us** — Mission/vision + values grid
9. **FAQ** — Accordion with 6-8 questions
10. **CTA Banner** — Final conversion section
11. **Footer** — Social links (TikTok, Instagram, Facebook), legal pages, copyright

### Landing Page Rules
- **ALL CTAs** → `https://app.yourdomain.com/#/login` (Flutter app subdomain)
- **Icons**: ONE color per section — use `primary-light` for all feature/course icons
- **Animations**: Use custom `ScrollReveal` (Intersection Observer) — no heavy animation libraries
- **CSS**: Use Tailwind CSS for styling (fast iteration, consistent spacing)
- **Fonts**: Same as Flutter app (DM Sans + Plus Jakarta Sans via Google Fonts)
- **Favicon**: Copy from Flutter app's `web/favicon.png`
- **Stats**: Dynamic from Supabase via server component (revalidates every 60s)
- **Sub-pages**: Privacy Policy, Terms of Use, Help & Support (all with Navbar + Footer)
- **SEO**: Proper `<title>`, `<meta description>`, Open Graph tags per page
- **Performance**: No `@supabase/supabase-js` — use native `fetch()` to Supabase REST API

### Required Legal/Support Pages
1. **Privacy Policy** — Data collection, cookies, third-party services, user rights
2. **Terms of Use** — Acceptable use, payment terms, refund policy, governing law
3. **Help & Support** — Contact info, getting started guide, payment troubleshooting, FAQ

### netlify.toml
```toml
[build]
  command = "npm run build"
  publish = ".next"

[build.environment]
  NEXT_PUBLIC_SUPABASE_URL = "https://your-project.supabase.co"
  NEXT_PUBLIC_SUPABASE_ANON_KEY = "your-anon-key"

[[plugins]]
  package = "@netlify/plugin-nextjs"
```

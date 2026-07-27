import { Platform } from "react-native";
import Purchases, {
  LOG_LEVEL,
  type CustomerInfo,
  type PurchasesOffering,
  type PurchasesPackage,
} from "react-native-purchases";

/**
 * POVMe RevenueCat integration.
 *
 * For in-app purchases on iOS/Android (the 30% store cut path for digital
 * content), we use RevenueCat. This handles:
 *   - Wallet top-up packs (consumable)
 *   - Tip bundles (consumable)
 *   - PPV unlocks (consumable)
 *
 * Subscriptions to creators use Stripe directly (not IAP) because the
 * 80/20 creator split can't go through Apple/Google's subscription system
 * without passing the 30% store cut onto creators, which would destroy
 * the economics.
 *
 * Configuration:
 *   EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY  — iOS App Store key
 *   EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY — Play Store key
 *   EXPO_PUBLIC_REVENUECAT_WEB_API_KEY    — Web/Stripe key (optional)
 *
 * Products are configured in the RevenueCat dashboard under the
 * "POVMe" project. Entitlement: "povme_credits".
 */

const APPLE_KEY = process.env.EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY;
const GOOGLE_KEY = process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY;
const WEB_KEY = process.env.EXPO_PUBLIC_REVENUECAT_WEB_API_KEY;

let initialized = false;

/**
 * Initialize RevenueCat with the platform-appropriate API key.
 * Call this once after the user signs in.
 */
export async function initRevenueCat(userId: string): Promise<void> {
  if (initialized) return;

  let apiKey: string | undefined;
  if (Platform.OS === "ios") {
    apiKey = APPLE_KEY;
  } else if (Platform.OS === "android") {
    apiKey = GOOGLE_KEY;
  } else {
    apiKey = WEB_KEY;
  }

  if (!apiKey) {
    console.log("[povme] RevenueCat API key not set for platform:", Platform.OS);
    return;
  }

  try {
    Purchases.setLogLevel(Purchases.LOG_LEVEL.WARN);
    await Purchases.configure({ apiKey, appUserID: userId });
    initialized = true;
  } catch (err) {
    console.error("[povme] RevenueCat init failed:", err);
  }
}

/**
 * Get the current offering (product catalog) from RevenueCat.
 */
export async function getOffering(): Promise<PurchasesOffering | null> {
  if (!initialized) return null;
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current;
  } catch (err) {
    console.error("[povme] getOffering failed:", err);
    return null;
  }
}

/**
 * Purchase a package (e.g. wallet top-up pack).
 * Returns the CustomerInfo after purchase.
 */
export async function purchasePackage(
  pkg: PurchasesPackage,
): Promise<CustomerInfo | null> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return customerInfo;
  } catch (err: unknown) {
    const error = err as { userCancelled?: boolean; message?: string };
    if (error.userCancelled) {
      return null;
    }
    console.error("[povme] purchasePackage failed:", err);
    throw err;
  }
}

/**
 * Restore previous purchases (required by App Store review).
 */
export async function restorePurchases(): Promise<CustomerInfo | null> {
  try {
    const customerInfo = await Purchases.restorePurchases();
    return customerInfo;
  } catch (err) {
    console.error("[povme] restorePurchases failed:", err);
    throw err;
  }
}

/**
 * Get current customer info (entitlements, active subscriptions).
 */
export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  if (!initialized) return null;
  try {
    return await Purchases.getCustomerInfo();
  } catch (err) {
    console.error("[povme] getCustomerInfo failed:", err);
    return null;
  }
}

/**
 * Check if the user has the "povme_credits" entitlement active.
 */
export async function hasCreditsEntitlement(): Promise<boolean> {
  const info = await getCustomerInfo();
  if (!info) return false;
  return info.entitlements.active["povme_credits"] !== undefined;
}

/**
 * Log out / reset the RevenueCat user.
 */
export function resetRevenueCat(): void {
  if (initialized) {
    Purchases.logOut().catch(() => {});
    initialized = false;
  }
}

export type { CustomerInfo, PurchasesOffering, PurchasesPackage };

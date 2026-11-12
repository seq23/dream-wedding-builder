import { getCloudflareContext } from '@opennextjs/cloudflare';

export type RuntimeEnv = {
  DB?: any;
  APP_SHARING_ENABLED?: string;
  APP_PURCHASES_ENABLED?: string;
  APP_METRICS_ENABLED?: string;
  REVENUECAT_SECRET?: string;
  PRODUCT_RELEASES?: any;
  RESEND_API_KEY?: string;
  APP_FROM_EMAIL?: string;
  APP_REPLY_TO_EMAIL?: string;
  APP_BASE_URL?: string;
  DOWNLOAD_SIGNING_SECRET?: string;
  ENTITLEMENT_HASH_SECRET?: string;
};

export async function runtimeEnv(): Promise<RuntimeEnv> {
  const context = await getCloudflareContext({ async: true });
  return context.env as unknown as RuntimeEnv;
}

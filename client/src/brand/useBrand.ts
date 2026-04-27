import { useGetStartupConfig } from '~/data-provider';
import { brandDefaults, type BrandConfig } from './tokens';

/**
 * Returns the merged brand config: server-provided values from
 * `startupConfig.interface.brand` take precedence over local defaults.
 */
export function useBrand(): BrandConfig {
  const { data: startupConfig } = useGetStartupConfig();
  const remote = startupConfig?.interface?.brand ?? {};
  return {
    logoSidebar: remote.logoSidebar ?? brandDefaults.logoSidebar,
    logos: remote.logos ?? brandDefaults.logos,
    background: remote.background ?? brandDefaults.background,
    landingImages: remote.landingImages ?? brandDefaults.landingImages,
    heroImage: remote.heroImage ?? brandDefaults.heroImage,
  };
}

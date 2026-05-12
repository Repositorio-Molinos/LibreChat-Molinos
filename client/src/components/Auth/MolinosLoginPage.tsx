import { useEffect } from 'react';
import type { TStartupConfig } from 'librechat-data-provider';
import { BrandDecorativeFrame } from '~/brand';

/**
 * Pantalla de login con identidad visual Molinos. Reemplaza el AuthLayout
 * estándar de LibreChat para la ruta /login cuando el único método activo
 * es OpenID (Microsoft Entra).
 *
 * Si `openidAutoRedirect` está habilitado, redirige automáticamente al
 * provider de OpenID al montar (la pantalla se muestra brevemente antes
 * del redirect). Si no, el usuario tiene que tocar el botón.
 */
export default function MolinosLoginPage({
  startupConfig,
}: {
  startupConfig: TStartupConfig | null | undefined;
}) {
  const loginHref =
    startupConfig?.openidLoginEnabled === true && startupConfig?.serverDomain
      ? `${startupConfig.serverDomain}/oauth/openid`
      : '#';

  useEffect(() => {
    if (
      startupConfig?.openidLoginEnabled === true &&
      startupConfig?.openidAutoRedirect === true &&
      startupConfig?.serverDomain
    ) {
      window.location.href = `${startupConfig.serverDomain}/oauth/openid`;
    }
  }, [startupConfig]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-white text-slate-900">
      <div className="absolute inset-0 flex items-center justify-center">
        <BrandDecorativeFrame className="max-h-full" />
      </div>

      <section className="relative mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center gap-10 px-6 py-10">
        <img
          src="/assets/molinos-claim.svg"
          alt="Molinos IA"
          className="w-[min(70vw,360px)] select-none"
        />
        <a
          href={loginHref}
          className="inline-flex items-center justify-center gap-3 rounded-full border border-black bg-white px-6 py-2 text-lg font-semibold text-slate-900 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
        >
          <span aria-hidden="true" className="grid h-4 w-4 grid-cols-2 gap-[1px]">
            <span className="bg-[#f25022]" />
            <span className="bg-[#7fba00]" />
            <span className="bg-[#00a4ef]" />
            <span className="bg-[#ffb900]" />
          </span>
          Iniciar sesión con Microsoft
        </a>
      </section>
    </main>
  );
}

const client = require('openid-client');
const { logger } = require('@librechat/data-schemas');
const { CacheKeys } = require('librechat-data-provider');
const { getOpenIdConfig } = require('~/strategies/openidStrategy');
const getLogStores = require('~/cache/getLogStores');

/**
 * Detect errors from Entra OBO that indicate the assertion (federated access_token)
 * is expired or otherwise invalid. Conservative match: anything that looks like a
 * grant/assertion failure triggers a refresh+retry. Other errors (network, 5xx)
 * propagate as before so we don't loop on real outages.
 */
function isAssertionLikelyExpired(error) {
  if (!error) return false;
  const code = error.error || error.code;
  const desc = (error.error_description || error.message || '').toLowerCase();
  if (code === 'invalid_grant') return true;
  if (typeof desc === 'string') {
    if (desc.includes('aadsts50013')) return true; // assertion validation failed
    if (desc.includes('aadsts700024')) return true; // assertion not within valid time
    if (desc.includes('aadsts50173')) return true; // fresh auth token needed
    if (desc.includes('expired')) return true;
    if (desc.includes('assertion')) return true;
  }
  return false;
}

/**
 * Refresh the federated access_token using the stored refresh_token.
 * Mutates `user.federatedTokens` in place so subsequent calls in this request
 * use the fresh token. NOTE: does not persist back to session/cookies — the next
 * request will re-trigger this dance unless `setOpenIDAuthTokens` is called from
 * higher in the stack. Tracked as a follow-up.
 */
async function refreshFederatedToken(user) {
  const refreshToken = user.federatedTokens?.refresh_token;
  if (!refreshToken) {
    throw new Error('No federated refresh_token available — user must re-authenticate');
  }

  const config = getOpenIdConfig();
  if (!config) {
    throw new Error('OpenID configuration not available');
  }

  logger.info(`[GraphTokenService] Refreshing federated access_token for user: ${user.openidId}`);
  const tokenset = await client.refreshTokenGrant(config, refreshToken);

  if (!tokenset?.access_token) {
    throw new Error('Refresh response missing access_token');
  }

  user.federatedTokens = {
    ...user.federatedTokens,
    access_token: tokenset.access_token,
    id_token: tokenset.id_token ?? user.federatedTokens.id_token,
    refresh_token: tokenset.refresh_token ?? user.federatedTokens.refresh_token,
    expires_at: tokenset.expires_at,
  };

  return tokenset.access_token;
}

async function exchangeOboToken(config, accessToken, scopes) {
  return client.genericGrantRequest(
    config,
    'urn:ietf:params:oauth:grant-type:jwt-bearer',
    {
      scope: scopes,
      assertion: accessToken,
      requested_token_use: 'on_behalf_of',
    },
  );
}

/**
 * Get Microsoft Graph API token using existing token exchange mechanism.
 *
 * On expired assertion error, refresh the federated access_token via the stored
 * refresh_token and retry OBO once. Any other failure propagates.
 *
 * @param {Object} user - User object with OpenID information
 * @param {string} accessToken - Federated access token used as OBO assertion
 * @param {string} scopes - Graph API scopes for the token
 * @param {boolean} fromCache - Whether to try getting token from cache first
 * @returns {Promise<Object>} Graph API token response with access_token and expires_in
 */
async function getGraphApiToken(user, accessToken, scopes, fromCache = true) {
  try {
    if (!user.openidId) {
      throw new Error('User must be authenticated via Entra ID to access Microsoft Graph');
    }

    if (!accessToken) {
      throw new Error('Access token is required for token exchange');
    }

    if (!scopes) {
      throw new Error('Graph API scopes are required for token exchange');
    }

    const config = getOpenIdConfig();
    if (!config) {
      throw new Error('OpenID configuration not available');
    }

    const cacheKey = `${user.openidId}:${scopes}`;
    const tokensCache = getLogStores(CacheKeys.OPENID_EXCHANGED_TOKENS);

    if (fromCache) {
      const cachedToken = await tokensCache.get(cacheKey);
      if (cachedToken) {
        logger.debug(`[GraphTokenService] Using cached Graph API token for user: ${user.openidId}`);
        return cachedToken;
      }
    }

    logger.debug(`[GraphTokenService] Requesting new Graph API token for user: ${user.openidId}`);
    logger.debug(`[GraphTokenService] Requested scopes: ${scopes}`);

    let grantResponse;
    try {
      grantResponse = await exchangeOboToken(config, accessToken, scopes);
    } catch (oboError) {
      if (!isAssertionLikelyExpired(oboError)) {
        throw oboError;
      }
      logger.warn(
        `[GraphTokenService] OBO failed with likely-expired assertion for user ${user.openidId}; refreshing and retrying. error=${oboError.error || ''} description=${oboError.error_description || oboError.message || ''}`,
      );
      const freshAccessToken = await refreshFederatedToken(user);
      grantResponse = await exchangeOboToken(config, freshAccessToken, scopes);
    }

    const tokenResponse = {
      access_token: grantResponse.access_token,
      token_type: 'Bearer',
      expires_in: grantResponse.expires_in || 3600,
      scope: scopes,
    };

    await tokensCache.set(
      cacheKey,
      tokenResponse,
      (grantResponse.expires_in || 3600) * 1000, // Convert to milliseconds
    );

    logger.debug(
      `[GraphTokenService] Successfully obtained and cached Graph API token for user: ${user.openidId}`,
    );
    return tokenResponse;
  } catch (error) {
    logger.error(
      `[GraphTokenService] Failed to acquire Graph API token for user ${user.openidId}:`,
      error,
    );
    throw new Error(`Graph token acquisition failed: ${error.message}`);
  }
}

module.exports = {
  getGraphApiToken,
};

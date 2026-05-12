const cache = require('memory-cache');
const HttpError = require('@stores.com/http-error');

function FedEx(args) {
    const _options = {
        url: 'https://apis.fedex.com',
        ...args
    };

    /**
     * Request an OAuth access token from FedEx using the `client_credentials` grant. Tokens
     * are cached in memory per API key for half their lifetime, so repeat calls return the
     * same token until it's close to expiring.
     *
     * @param {object} [options]
     * @param {number} [options.timeout=30000] - Request timeout in milliseconds.
     * @returns {Promise<{ access_token: string, expires_in: number, scope: string, token_type: string }>}
     * @see https://developer.fedex.com/api/en-us/catalog/authorization.html
     */
    this.getAccessToken = async (options = {}) => {
        const key = `fedex_${_options.api_key}`;
        const accessToken = cache.get(key);

        if (accessToken) {
            return accessToken;
        }

        const res = await fetch(`${_options.url}/oauth/token`, {
            body: new URLSearchParams({
                client_id: _options.api_key,
                client_secret: _options.secret_key,
                grant_type: 'client_credentials'
            }),
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            method: 'POST',
            signal: AbortSignal.timeout(options.timeout || 30000)
        });

        if (!res.ok) {
            throw await HttpError.from(res);
        }

        const json = await res.json();

        cache.put(key, json, Number(json.expires_in) * 1000 / 2);

        return json;
    };

    /**
     * Call the FedEx Rates and Transit Times API. The caller supplies the full request body
     * — `accountNumber`, `requestedShipment`, and any of `rateRequestControlParameters`,
     * `carrierCodes`, `processingOptions`, `version` — and the package forwards it verbatim.
     *
     * @param {object} rateRequest - Full Rates and Transit Times request body.
     * @param {object} [options]
     * @param {number} [options.timeout=30000] - Request timeout in milliseconds.
     * @returns {Promise<object>} The parsed response body, including `output.rateReplyDetails[]`.
     * @see https://developer.fedex.com/api/en-us/catalog/rate/v1/docs.html
     */
    this.rateAndTransitTimes = async (rateRequest, options = {}) => {
        const accessToken = await this.getAccessToken();

        const res = await fetch(`${_options.url}/rate/v1/rates/quotes`, {
            body: JSON.stringify(rateRequest),
            headers: {
                Authorization: `Bearer ${accessToken.access_token}`,
                'Content-Type': 'application/json'
            },
            method: 'POST',
            signal: AbortSignal.timeout(options.timeout || 30000)
        });

        if (!res.ok) {
            throw await HttpError.from(res);
        }

        const json = await res.json();

        if (json.errors?.length) {
            throw await HttpError.from(res);
        }

        return json;
    };
}

module.exports = FedEx;

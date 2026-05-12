const cache = require('memory-cache');
const HttpError = require('@stores.com/http-error');

function FedEx(args) {
    const _options = {
        url: 'https://apis.fedex.com',
        ...args
    };

    /**
     * FedEx APIs use the OAuth 2.0 protocol for authentication and authorization using the client_credentials grant type.
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
     * Rates and Transit Times: request rate quotes and transit times from FedEx.
     * The caller supplies the full request body (accountNumber, requestedShipment, and any of
     * rateRequestControlParameters, carrierCodes, processingOptions, version, etc.);
     * the package forwards it verbatim.
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

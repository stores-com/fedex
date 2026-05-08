const cache = require('memory-cache');

const HttpError = require('@stores.com/http-error');

function FedEx(args) {
    const options = {
        url: 'https://apis.fedex.com',
        ...args
    };

    /**
     * FedEx APIs use the OAuth 2.0 protocol for authentication and authorization using the client_credentials grant type.
     * @see https://developer.fedex.com/api/en-us/catalog/authorization.html
     */
    this.getAccessToken = async (_options = {}) => {
        const key = `fedex_${options.api_key}`;
        const accessToken = cache.get(key);

        if (accessToken) {
            return accessToken;
        }

        const res = await fetch(`${options.url}/oauth/token`, {
            body: new URLSearchParams({
                client_id: options.api_key,
                client_secret: options.secret_key,
                grant_type: 'client_credentials'
            }),
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            method: 'POST',
            signal: AbortSignal.timeout(_options.timeout || 30000)
        });

        if (!res.ok) {
            throw await HttpError.from(res);
        }

        const json = await res.json();

        cache.put(key, json, (Number(json.expires_in) - 100) * 1000);

        return json;
    };

    /**
     * Request rate quotes from FedEx for a shipment. The caller supplies only the requestedShipment body;
     * the package fills the top-level accountNumber and rateRequestControlParameters envelope.
     * @see https://developer.fedex.com/api/en-us/catalog/rate.html
     */
    this.rates = async (requestedShipment, _options = {}) => {
        const accessToken = await this.getAccessToken();

        const res = await fetch(`${options.url}/rate/v1/rates/quotes`, {
            body: JSON.stringify({
                accountNumber: { value: options.account_number },
                rateRequestControlParameters: {
                    rateSortOrder: 'SERVICENAMETRADITIONAL',
                    returnTransitTime: true,
                    servicesNeededOnRateFailure: true
                },
                requestedShipment
            }),
            headers: {
                Authorization: `Bearer ${accessToken.access_token}`,
                'Content-Type': 'application/json'
            },
            method: 'POST',
            signal: AbortSignal.timeout(_options.timeout || 30000)
        });

        if (!res.ok) {
            throw await HttpError.from(res);
        }

        const body = await res.json();

        if (body.errors?.length) {
            throw new Error(`${body.errors[0].code}: ${body.errors[0].message}`);
        }

        return body;
    };
}

module.exports = FedEx;

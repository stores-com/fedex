const cache = require('memory-cache');
const HttpError = require('@stores.com/http-error');

function FedEx(args) {
    const _options = {
        url: 'https://apis.fedex.com',
        ...args
    };

    /**
     * Cancel a FedEx shipment via the Ship API. The caller supplies the full
     * request body — `accountNumber`, `trackingNumber`, `senderCountryCode`,
     * `deletionControl` — and the package forwards it verbatim.
     *
     * @param {object} cancelRequest - Full Cancel Shipment request body.
     * @param {object} [options]
     * @param {string} [options.customer_transaction_id] - Sent as the `x-customer-transaction-id`
     *   request header. FedEx echoes this back so callers can correlate requests with responses.
     * @param {number} [options.timeout=30000] - Request timeout in milliseconds.
     * @returns {Promise<object>} The parsed response body.
     * @see https://developer.fedex.com/api/en-us/catalog/ship/v1/docs.html
     */
    this.cancelShipment = async (cancelRequest, options = {}) => {
        const accessToken = await this.getAccessToken();

        const headers = {
            Authorization: `Bearer ${accessToken.access_token}`,
            'Content-Type': 'application/json'
        };

        if (options.customer_transaction_id) {
            headers['x-customer-transaction-id'] = options.customer_transaction_id;
        }

        const response = await fetch(`${_options.url}/ship/v1/shipments/cancel`, {
            body: JSON.stringify(cancelRequest),
            headers,
            method: 'PUT',
            signal: AbortSignal.timeout(options.timeout || 30000)
        });

        if (!response.ok) {
            throw await HttpError.from(response);
        }

        const json = await response.json();

        if (json.errors?.length) {
            throw await HttpError.from(response);
        }

        return json;
    };

    /**
     * Create a FedEx shipment via the Ship API. The caller supplies the full
     * request body — `accountNumber`, `labelResponseOptions`, `requestedShipment`
     * — and the package forwards it verbatim.
     *
     * @param {object} shipRequest - Full Create Shipment request body.
     * @param {object} [options]
     * @param {string} [options.customer_transaction_id] - Sent as the `x-customer-transaction-id`
     *   request header. FedEx echoes this back so callers can correlate requests with responses.
     * @param {number} [options.timeout=30000] - Request timeout in milliseconds.
     * @returns {Promise<object>} The parsed response body, including `output.transactionShipments[]`.
     * @see https://developer.fedex.com/api/en-us/catalog/ship/v1/docs.html
     */
    this.createShipment = async (shipRequest, options = {}) => {
        const accessToken = await this.getAccessToken();

        const headers = {
            Authorization: `Bearer ${accessToken.access_token}`,
            'Content-Type': 'application/json'
        };

        if (options.customer_transaction_id) {
            headers['x-customer-transaction-id'] = options.customer_transaction_id;
        }

        const response = await fetch(`${_options.url}/ship/v1/shipments`, {
            body: JSON.stringify(shipRequest),
            headers,
            method: 'POST',
            signal: AbortSignal.timeout(options.timeout || 30000)
        });

        if (!response.ok) {
            throw await HttpError.from(response);
        }

        const json = await response.json();

        if (json.errors?.length) {
            throw await HttpError.from(response);
        }

        return json;
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
        const key = `fedex:${_options.api_key}`;
        const accessToken = cache.get(key);

        if (accessToken) {
            return accessToken;
        }

        const response = await fetch(`${_options.url}/oauth/token`, {
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

        if (!response.ok) {
            throw await HttpError.from(response);
        }

        const json = await response.json();

        cache.put(key, json, Number(json.expires_in) * 1000 / 2);

        return json;
    };

    /**
     * Close out FedEx Ground shipments via the Ground End of Day Close API. The
     * caller supplies the full request body — `accountNumber`, `closeDate`,
     * `closeReqType`, `groundServiceCategory` — and the package forwards it
     * verbatim.
     *
     * @param {object} closeRequest - Full Ground End of Day Close request body.
     * @param {object} [options]
     * @param {string} [options.customer_transaction_id] - Sent as the `x-customer-transaction-id`
     *   request header. FedEx echoes this back so callers can correlate requests with responses.
     * @param {number} [options.timeout=30000] - Request timeout in milliseconds.
     * @returns {Promise<object>} The parsed response body, including `output.closeDocuments[]`.
     * @see https://developer.fedex.com/api/en-us/catalog/close/v1/docs.html
     */
    this.groundEndOfDayClose = async (closeRequest, options = {}) => {
        const accessToken = await this.getAccessToken();

        const headers = {
            Authorization: `Bearer ${accessToken.access_token}`,
            'Content-Type': 'application/json'
        };

        if (options.customer_transaction_id) {
            headers['x-customer-transaction-id'] = options.customer_transaction_id;
        }

        const response = await fetch(`${_options.url}/ship/v1/endofday/`, {
            body: JSON.stringify(closeRequest),
            headers,
            method: 'PUT',
            signal: AbortSignal.timeout(options.timeout || 30000)
        });

        if (!response.ok) {
            throw await HttpError.from(response);
        }

        const json = await response.json();

        if (json.errors?.length) {
            throw await HttpError.from(response);
        }

        return json;
    };

    /**
     * Call the FedEx Rates and Transit Times API. The caller supplies the full request body
     * — `accountNumber`, `requestedShipment`, and any of `rateRequestControlParameters`,
     * `carrierCodes`, `processingOptions`, `version` — and the package forwards it verbatim.
     *
     * @param {object} rateRequest - Full Rates and Transit Times request body.
     * @param {object} [options]
     * @param {string} [options.customer_transaction_id] - Sent as the `x-customer-transaction-id`
     *   request header. FedEx echoes this back so callers can correlate requests with responses.
     * @param {number} [options.timeout=30000] - Request timeout in milliseconds.
     * @returns {Promise<object>} The parsed response body, including `output.rateReplyDetails[]`.
     * @see https://developer.fedex.com/api/en-us/catalog/rate/v1/docs.html
     */
    this.rateAndTransitTimes = async (rateRequest, options = {}) => {
        const accessToken = await this.getAccessToken();

        const headers = {
            Authorization: `Bearer ${accessToken.access_token}`,
            'Content-Type': 'application/json'
        };

        if (options.customer_transaction_id) {
            headers['x-customer-transaction-id'] = options.customer_transaction_id;
        }

        const response = await fetch(`${_options.url}/rate/v1/rates/quotes`, {
            body: JSON.stringify(rateRequest),
            headers,
            method: 'POST',
            signal: AbortSignal.timeout(options.timeout || 30000)
        });

        if (!response.ok) {
            throw await HttpError.from(response);
        }

        const json = await response.json();

        if (json.errors?.length) {
            throw await HttpError.from(response);
        }

        return json;
    };

    /**
     * Track a FedEx shipment via the Track API. The caller supplies the full request
     * body — `includeDetailedScans`, `trackingInfo` — and the package forwards it
     * verbatim.
     *
     * @param {object} trackRequest - Full Track by Tracking Number request body.
     * @param {object} [options]
     * @param {string} [options.customer_transaction_id] - Sent as the `x-customer-transaction-id`
     *   request header. FedEx echoes this back so callers can correlate requests with responses.
     * @param {number} [options.timeout=30000] - Request timeout in milliseconds.
     * @returns {Promise<object>} The parsed response body, including `output.completeTrackResults[]`.
     * @see https://developer.fedex.com/api/en-us/catalog/track/v1/docs.html
     */
    this.track = async (trackRequest, options = {}) => {
        const accessToken = await this.getAccessToken();

        const headers = {
            Authorization: `Bearer ${accessToken.access_token}`,
            'Content-Type': 'application/json'
        };

        if (options.customer_transaction_id) {
            headers['x-customer-transaction-id'] = options.customer_transaction_id;
        }

        const response = await fetch(`${_options.url}/track/v1/trackingnumbers`, {
            body: JSON.stringify(trackRequest),
            headers,
            method: 'POST',
            signal: AbortSignal.timeout(options.timeout || 30000)
        });

        if (!response.ok) {
            throw await HttpError.from(response);
        }

        const json = await response.json();

        if (json.errors?.length) {
            throw await HttpError.from(response);
        }

        return json;
    };

    /**
     * Call the FedEx Address Validation API. The caller supplies the full request body
     * — `addressesToValidate` and optionally `inEffectAsOfTimestamp` — and the package
     * forwards it verbatim.
     *
     * @param {object} addressValidationRequest - Full Address Validation request body.
     * @param {object} [options]
     * @param {string} [options.customer_transaction_id] - Sent as the `x-customer-transaction-id`
     *   request header. FedEx echoes this back so callers can correlate requests with responses.
     * @param {number} [options.timeout=30000] - Request timeout in milliseconds.
     * @returns {Promise<object>} The parsed response body, including `output.resolvedAddresses[]`.
     * @see https://developer.fedex.com/api/en-us/catalog/address-validation/v1/docs.html
     */
    this.validateAddress = async (addressValidationRequest, options = {}) => {
        const accessToken = await this.getAccessToken();

        const headers = {
            Authorization: `Bearer ${accessToken.access_token}`,
            'Content-Type': 'application/json'
        };

        if (options.customer_transaction_id) {
            headers['x-customer-transaction-id'] = options.customer_transaction_id;
        }

        const response = await fetch(`${_options.url}/address/v1/addresses/resolve`, {
            body: JSON.stringify(addressValidationRequest),
            headers,
            method: 'POST',
            signal: AbortSignal.timeout(options.timeout || 30000)
        });

        if (!response.ok) {
            throw await HttpError.from(response);
        }

        const json = await response.json();

        if (json.errors?.length) {
            throw await HttpError.from(response);
        }

        return json;
    };
}

module.exports = FedEx;

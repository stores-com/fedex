const assert = require('node:assert');
const test = require('node:test');
const sleep = require('node:timers/promises').setTimeout;

const FedEx = require('../index');

const MOCK_URL = 'https://mocks.fedex.com';

// Short retry for riding out transient blips
async function retry(fn, attempts = 5) {
    for (let i = 1; i <= attempts; i++) {
        try {
            return await fn();
        } catch (err) {
            if (i === attempts) {
                throw err;
            }

            await sleep(1000);
        }
    }
}

function mockOAuthResponse() {
    return new Response(JSON.stringify({ access_token: 'mock', expires_in: 3600, token_type: 'bearer' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200
    });
}

function shipment(opts) {
    opts = opts || {};

    const body = {
        packagingType: 'YOUR_PACKAGING',
        pickupType: 'USE_SCHEDULED_PICKUP',
        preferredCurrency: 'USD',
        rateRequestType: ['ACCOUNT'],
        recipient: {
            address: {
                city: 'New York',
                countryCode: 'US',
                postalCode: '10118',
                residential: false,
                stateOrProvinceCode: 'NY',
                streetLines: ['350 5th Ave']
            },
            contact: {
                personName: 'Test Recipient',
                phoneNumber: '0000000000'
            }
        },
        requestedPackageLineItems: [{
            groupPackageCount: 1,
            weight: { units: 'LB', value: opts.smartPost ? 0.5 : 5 }
        }],
        serviceType: opts.serviceType || 'FEDEX_GROUND',
        shipDateStamp: new Date().toISOString().slice(0, 10),
        shipper: {
            address: {
                city: 'Lindon',
                countryCode: 'US',
                postalCode: '84042',
                stateOrProvinceCode: 'UT',
                streetLines: ['275 W 200 N']
            },
            contact: {
                companyName: 'Test Shipper',
                phoneNumber: '0000000000'
            }
        },
        totalPackageCount: 1
    };

    if (opts.smartPost) {
        body.smartPostInfoDetail = {
            ancillaryEndorsement: 'ADDRESS_CORRECTION',
            hubId: process.env.FEDEX_SMART_POST_HUB_ID,
            indicia: 'PRESORTED_STANDARD'
        };
    }

    return body;
}

test('getAccessToken', { concurrency: true }, async (t) => {
    t.test('should return an error for invalid url', async () => {
        const fedex = new FedEx({
            url: 'invalid'
        });

        await assert.rejects(fedex.getAccessToken(), { message: 'Failed to parse URL from invalid/oauth/token' });
    });

    t.test('should return an error for non 200 status code', async () => {
        const fedex = new FedEx({
            url: 'https://httpbin.org/status/500#'
        });

        await assert.rejects(fedex.getAccessToken(), (err) => {
            assert.strictEqual(err.name, 'HttpError');
            assert.match(err.message, /^500/);
            return true;
        });
    });

    t.test('should return a valid access token', async () => {
        const fedex = new FedEx({
            api_key: process.env.FEDEX_API_KEY,
            secret_key: process.env.FEDEX_SECRET_KEY,
            url: process.env.FEDEX_URL
        });

        const accessToken = await fedex.getAccessToken();

        assert(accessToken);
        assert(accessToken.access_token);
        assert(accessToken.expires_in);
        assert.strictEqual(accessToken.token_type, 'bearer');
    });

    t.test('should return the same access token on subsequent calls', async () => {
        const fedex = new FedEx({
            api_key: process.env.FEDEX_API_KEY,
            secret_key: process.env.FEDEX_SECRET_KEY,
            url: process.env.FEDEX_URL
        });

        const accessToken1 = await fedex.getAccessToken();
        const accessToken2 = await fedex.getAccessToken();

        assert.deepStrictEqual(accessToken2, accessToken1);
    });
});

function rateRequest(opts) {
    return {
        accountNumber: { value: process.env.FEDEX_ACCOUNT_NUMBER },
        requestedShipment: shipment(opts)
    };
}

test('rateAndTransitTimes', { concurrency: true }, async (t) => {
    t.test('should return rate quotes for a Ground shipment', async () => {
        const fedex = new FedEx({
            api_key: process.env.FEDEX_API_KEY,
            secret_key: process.env.FEDEX_SECRET_KEY,
            url: process.env.FEDEX_URL
        });

        const body = await retry(() => fedex.rateAndTransitTimes(rateRequest()));

        assert(body);
        assert(body.transactionId);
        assert(body.output);
        assert(Array.isArray(body.output.rateReplyDetails));
    });

    t.test('should return rate quotes for a SmartPost shipment', async () => {
        const fedex = new FedEx({
            api_key: process.env.FEDEX_API_KEY,
            secret_key: process.env.FEDEX_SECRET_KEY,
            url: process.env.FEDEX_URL
        });

        const body = await retry(() => fedex.rateAndTransitTimes(rateRequest({ serviceType: 'SMART_POST', smartPost: true })));

        assert(body);
        assert(body.transactionId);
        assert(body.output);
        assert(Array.isArray(body.output.rateReplyDetails));
    });
});

test('rateAndTransitTimes (mocked)', async (t) => {
    t.test('should throw HttpError for non 2xx response', async (t) => {
        t.mock.method(globalThis, 'fetch', async (url) => {
            if (url.endsWith('/oauth/token')) {
                return mockOAuthResponse();
            }

            if (url.endsWith('/rate/v1/rates/quotes')) {
                return new Response('', { status: 500, statusText: 'Internal Server Error' });
            }

            throw new Error(`Unexpected fetch URL: ${url}`);
        });

        const fedex = new FedEx({ api_key: 'mock', secret_key: 'mock', url: MOCK_URL });

        await assert.rejects(fedex.rateAndTransitTimes(rateRequest()), (err) => {
            assert.strictEqual(err.name, 'HttpError');
            assert.match(err.message, /^500/);
            return true;
        });
    });

    t.test('should throw HttpError for 200 response with errors envelope', async (t) => {
        t.mock.method(globalThis, 'fetch', async (url) => {
            if (url.endsWith('/oauth/token')) {
                return mockOAuthResponse();
            }

            if (url.endsWith('/rate/v1/rates/quotes')) {
                return new Response(JSON.stringify({
                    errors: [
                        { code: 'RATING.INVALID', message: 'Invalid account number' },
                        { code: 'SERVICE.UNAVAILABLE', message: 'Service is currently unavailable' }
                    ],
                    transactionId: 'mock'
                }), {
                    headers: { 'Content-Type': 'application/json' },
                    status: 200
                });
            }

            throw new Error(`Unexpected fetch URL: ${url}`);
        });

        const fedex = new FedEx({ api_key: 'mock', secret_key: 'mock', url: MOCK_URL });

        await assert.rejects(fedex.rateAndTransitTimes(rateRequest()), (err) => {
            assert.strictEqual(err.name, 'HttpError');
            return true;
        });
    });

    t.test('should send options.customer_transaction_id as x-customer-transaction-id header', async (t) => {
        let sentHeader;

        t.mock.method(globalThis, 'fetch', async (url, init) => {
            if (url.endsWith('/oauth/token')) {
                return mockOAuthResponse();
            }

            if (url.endsWith('/rate/v1/rates/quotes')) {
                sentHeader = init.headers['x-customer-transaction-id'];
                return new Response(JSON.stringify({ output: { rateReplyDetails: [] }, transactionId: 'mock' }), {
                    headers: { 'Content-Type': 'application/json' },
                    status: 200
                });
            }

            throw new Error(`Unexpected fetch URL: ${url}`);
        });

        const fedex = new FedEx({ api_key: 'mock', secret_key: 'mock', url: MOCK_URL });

        await fedex.rateAndTransitTimes(rateRequest(), { customer_transaction_id: 'abc-123' });

        assert.strictEqual(sentHeader, 'abc-123');
    });
});

function addressValidationRequest() {
    return {
        addressesToValidate: [{
            address: {
                city: 'New York',
                countryCode: 'US',
                postalCode: '10118',
                stateOrProvinceCode: 'NY',
                streetLines: ['350 5th Ave']
            }
        }]
    };
}

test('validateAddress', { concurrency: true }, async (t) => {
    t.test('should return resolved addresses', async () => {
        const fedex = new FedEx({
            api_key: process.env.FEDEX_API_KEY,
            secret_key: process.env.FEDEX_SECRET_KEY,
            url: process.env.FEDEX_URL
        });

        const body = await retry(() => fedex.validateAddress(addressValidationRequest()));

        assert(body);
        assert(body.transactionId);
        assert(body.output);
        assert(Array.isArray(body.output.resolvedAddresses));
    });
});

test('validateAddress (mocked)', async (t) => {
    t.test('should throw HttpError for non 2xx response', async (t) => {
        t.mock.method(globalThis, 'fetch', async (url) => {
            if (url.endsWith('/oauth/token')) {
                return mockOAuthResponse();
            }

            if (url.endsWith('/address/v1/addresses/resolve')) {
                return new Response('', { status: 500, statusText: 'Internal Server Error' });
            }

            throw new Error(`Unexpected fetch URL: ${url}`);
        });

        const fedex = new FedEx({ api_key: 'mock', secret_key: 'mock', url: MOCK_URL });

        await assert.rejects(fedex.validateAddress(addressValidationRequest()), (err) => {
            assert.strictEqual(err.name, 'HttpError');
            assert.match(err.message, /^500/);
            return true;
        });
    });

    t.test('should throw HttpError for 200 response with errors envelope', async (t) => {
        t.mock.method(globalThis, 'fetch', async (url) => {
            if (url.endsWith('/oauth/token')) {
                return mockOAuthResponse();
            }

            if (url.endsWith('/address/v1/addresses/resolve')) {
                return new Response(JSON.stringify({
                    errors: [
                        { code: 'ADDRESS.VALIDATION.FAILURE', message: 'Invalid address' }
                    ],
                    transactionId: 'mock'
                }), {
                    headers: { 'Content-Type': 'application/json' },
                    status: 200
                });
            }

            throw new Error(`Unexpected fetch URL: ${url}`);
        });

        const fedex = new FedEx({ api_key: 'mock', secret_key: 'mock', url: MOCK_URL });

        await assert.rejects(fedex.validateAddress(addressValidationRequest()), (err) => {
            assert.strictEqual(err.name, 'HttpError');
            return true;
        });
    });

    t.test('should send options.customer_transaction_id as x-customer-transaction-id header', async (t) => {
        let sentHeader;

        t.mock.method(globalThis, 'fetch', async (url, init) => {
            if (url.endsWith('/oauth/token')) {
                return mockOAuthResponse();
            }

            if (url.endsWith('/address/v1/addresses/resolve')) {
                sentHeader = init.headers['x-customer-transaction-id'];
                return new Response(JSON.stringify({
                    output: { resolvedAddresses: [{ classification: 'RESIDENTIAL' }] },
                    transactionId: 'mock'
                }), {
                    headers: { 'Content-Type': 'application/json' },
                    status: 200
                });
            }

            throw new Error(`Unexpected fetch URL: ${url}`);
        });

        const fedex = new FedEx({ api_key: 'mock', secret_key: 'mock', url: MOCK_URL });

        await fedex.validateAddress(addressValidationRequest(), { customer_transaction_id: 'abc-123' });

        assert.strictEqual(sentHeader, 'abc-123');
    });
});

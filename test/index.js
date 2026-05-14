const assert = require('node:assert');
const test = require('node:test');

const async = require('async');

const FedEx = require('../index');

test('cancelShipment', { concurrency: true }, async (t) => {
    t.test('should cancel a previously created shipment', async () => {
        const fedex = new FedEx({
            api_key: process.env.FEDEX_API_KEY,
            secret_key: process.env.FEDEX_SECRET_KEY,
            url: process.env.FEDEX_URL
        });

        const shipment = await async.retry(async () => fedex.createShipment({
            accountNumber: { value: process.env.FEDEX_ACCOUNT_NUMBER },
            labelResponseOptions: 'URL_ONLY',
            requestedShipment: {
                packagingType: 'YOUR_PACKAGING',
                pickupType: 'USE_SCHEDULED_PICKUP',
                recipients: [{
                    address: {
                        city: 'New York',
                        countryCode: 'US',
                        postalCode: '10001',
                        stateOrProvinceCode: 'NY',
                        streetLines: ['10 FedEx Pkwy']
                    },
                    contact: {
                        personName: 'Test Recipient',
                        phoneNumber: '0000000000'
                    }
                }],
                requestedPackageLineItems: [{
                    weight: { units: 'LB', value: 5 }
                }],
                serviceType: 'FEDEX_GROUND',
                shipper: {
                    address: {
                        city: 'Memphis',
                        countryCode: 'US',
                        postalCode: '38116',
                        stateOrProvinceCode: 'TN',
                        streetLines: ['10 FedEx Pkwy']
                    },
                    contact: {
                        companyName: 'Test Shipper',
                        phoneNumber: '0000000000'
                    }
                },
                labelSpecification: {
                    imageType: 'PNG',
                    labelStockType: 'PAPER_4X6'
                },
                shippingChargesPayment: { paymentType: 'SENDER' }
            }
        }));

        const trackingNumber = shipment.output.transactionShipments[0].masterTrackingNumber;

        assert(trackingNumber);

        const body = await async.retry(async () => fedex.cancelShipment({
            accountNumber: { value: process.env.FEDEX_ACCOUNT_NUMBER },
            deletionControl: 'DELETE_ALL_PACKAGES',
            senderCountryCode: 'US',
            trackingNumber
        }));

        assert(body);
        assert(body.transactionId);
    });
});

test('cancelShipment (mocked)', async (t) => {
    t.test('should send options.customer_transaction_id as x-customer-transaction-id header and use PUT method', async (t) => {
        let sentHeader;
        let sentMethod;

        t.mock.method(globalThis, 'fetch', async (url, init) => {
            if (url.endsWith('/oauth/token')) {
                return new Response(JSON.stringify({ access_token: 'mock', expires_in: 3600, token_type: 'bearer' }), {
                    headers: { 'Content-Type': 'application/json' },
                    status: 200
                });
            }

            if (url.endsWith('/ship/v1/shipments/cancel')) {
                sentHeader = init.headers['x-customer-transaction-id'];
                sentMethod = init.method;
                return new Response(JSON.stringify({ output: { cancelledShipment: true }, transactionId: 'mock' }), {
                    headers: { 'Content-Type': 'application/json' },
                    status: 200
                });
            }

            throw new Error(`Unexpected fetch URL: ${url}`);
        });

        const fedex = new FedEx({ api_key: 'mock', secret_key: 'mock' });

        await fedex.cancelShipment({
            accountNumber: { value: process.env.FEDEX_ACCOUNT_NUMBER },
            deletionControl: 'DELETE_ALL_PACKAGES',
            senderCountryCode: 'US',
            trackingNumber: '794644790138'
        }, { customer_transaction_id: 'abc-123' });

        assert.strictEqual(sentHeader, 'abc-123');
        assert.strictEqual(sentMethod, 'PUT');
    });

    t.test('should throw HttpError for 200 response with errors envelope', async (t) => {
        t.mock.method(globalThis, 'fetch', async (url) => {
            if (url.endsWith('/oauth/token')) {
                return new Response(JSON.stringify({ access_token: 'mock', expires_in: 3600, token_type: 'bearer' }), {
                    headers: { 'Content-Type': 'application/json' },
                    status: 200
                });
            }

            if (url.endsWith('/ship/v1/shipments/cancel')) {
                return new Response(JSON.stringify({
                    errors: [
                        { code: 'SHIPMENT.CANCEL.FAILURE', message: 'Shipment already tendered' }
                    ],
                    transactionId: 'mock'
                }), {
                    headers: { 'Content-Type': 'application/json' },
                    status: 200
                });
            }

            throw new Error(`Unexpected fetch URL: ${url}`);
        });

        const fedex = new FedEx({ api_key: 'mock', secret_key: 'mock' });

        await assert.rejects(fedex.cancelShipment({
            accountNumber: { value: process.env.FEDEX_ACCOUNT_NUMBER },
            deletionControl: 'DELETE_ALL_PACKAGES',
            senderCountryCode: 'US',
            trackingNumber: '794644790138'
        }), (err) => {
            assert.strictEqual(err.name, 'HttpError');
            return true;
        });
    });

    t.test('should throw HttpError for non 2xx response', async (t) => {
        t.mock.method(globalThis, 'fetch', async (url) => {
            if (url.endsWith('/oauth/token')) {
                return new Response(JSON.stringify({ access_token: 'mock', expires_in: 3600, token_type: 'bearer' }), {
                    headers: { 'Content-Type': 'application/json' },
                    status: 200
                });
            }

            if (url.endsWith('/ship/v1/shipments/cancel')) {
                return new Response('', { status: 500, statusText: 'Internal Server Error' });
            }

            throw new Error(`Unexpected fetch URL: ${url}`);
        });

        const fedex = new FedEx({ api_key: 'mock', secret_key: 'mock' });

        await assert.rejects(fedex.cancelShipment({
            accountNumber: { value: process.env.FEDEX_ACCOUNT_NUMBER },
            deletionControl: 'DELETE_ALL_PACKAGES',
            senderCountryCode: 'US',
            trackingNumber: '794644790138'
        }), (err) => {
            assert.strictEqual(err.name, 'HttpError');
            assert.match(err.message, /^500/);
            return true;
        });
    });
});

test('createShipment', { concurrency: true }, async (t) => {
    t.test('should create a FedEx Ground shipment', async () => {
        const fedex = new FedEx({
            api_key: process.env.FEDEX_API_KEY,
            secret_key: process.env.FEDEX_SECRET_KEY,
            url: process.env.FEDEX_URL
        });

        const body = await async.retry(async () => fedex.createShipment({
            accountNumber: { value: process.env.FEDEX_ACCOUNT_NUMBER },
            labelResponseOptions: 'URL_ONLY',
            requestedShipment: {
                packagingType: 'YOUR_PACKAGING',
                pickupType: 'USE_SCHEDULED_PICKUP',
                recipients: [{
                    address: {
                        city: 'New York',
                        countryCode: 'US',
                        postalCode: '10001',
                        stateOrProvinceCode: 'NY',
                        streetLines: ['10 FedEx Pkwy']
                    },
                    contact: {
                        personName: 'Test Recipient',
                        phoneNumber: '0000000000'
                    }
                }],
                requestedPackageLineItems: [{
                    weight: { units: 'LB', value: 5 }
                }],
                serviceType: 'FEDEX_GROUND',
                shipper: {
                    address: {
                        city: 'Memphis',
                        countryCode: 'US',
                        postalCode: '38116',
                        stateOrProvinceCode: 'TN',
                        streetLines: ['10 FedEx Pkwy']
                    },
                    contact: {
                        companyName: 'Test Shipper',
                        phoneNumber: '0000000000'
                    }
                },
                labelSpecification: {
                    imageType: 'PNG',
                    labelStockType: 'PAPER_4X6'
                },
                shippingChargesPayment: { paymentType: 'SENDER' }
            }
        }));

        assert(body);
        assert(body.transactionId);
        assert(body.output);
    });
});

test('createShipment (mocked)', async (t) => {
    t.test('should send options.customer_transaction_id as x-customer-transaction-id header and use POST method', async (t) => {
        let sentHeader;
        let sentMethod;

        t.mock.method(globalThis, 'fetch', async (url, init) => {
            if (url.endsWith('/oauth/token')) {
                return new Response(JSON.stringify({ access_token: 'mock', expires_in: 3600, token_type: 'bearer' }), {
                    headers: { 'Content-Type': 'application/json' },
                    status: 200
                });
            }

            if (url.endsWith('/ship/v1/shipments')) {
                sentHeader = init.headers['x-customer-transaction-id'];
                sentMethod = init.method;
                return new Response(JSON.stringify({ output: { transactionShipments: [{ masterTrackingNumber: '794644790138' }] }, transactionId: 'mock' }), {
                    headers: { 'Content-Type': 'application/json' },
                    status: 200
                });
            }

            throw new Error(`Unexpected fetch URL: ${url}`);
        });

        const fedex = new FedEx({ api_key: 'mock', secret_key: 'mock' });

        await fedex.createShipment({
            accountNumber: { value: process.env.FEDEX_ACCOUNT_NUMBER },
            labelResponseOptions: 'URL_ONLY',
            requestedShipment: {
                packagingType: 'YOUR_PACKAGING',
                pickupType: 'USE_SCHEDULED_PICKUP',
                recipients: [{
                    address: { countryCode: 'US', postalCode: '10001' },
                    contact: { personName: 'Test', phoneNumber: '0000000000' }
                }],
                requestedPackageLineItems: [{ weight: { units: 'LB', value: 5 } }],
                serviceType: 'FEDEX_GROUND',
                shipper: {
                    address: { countryCode: 'US', postalCode: '38116' },
                    contact: { companyName: 'Test', phoneNumber: '0000000000' }
                },
                shippingChargesPayment: { paymentType: 'SENDER' }
            }
        }, { customer_transaction_id: 'abc-123' });

        assert.strictEqual(sentHeader, 'abc-123');
        assert.strictEqual(sentMethod, 'POST');
    });

    t.test('should throw HttpError for 200 response with errors envelope', async (t) => {
        t.mock.method(globalThis, 'fetch', async (url) => {
            if (url.endsWith('/oauth/token')) {
                return new Response(JSON.stringify({ access_token: 'mock', expires_in: 3600, token_type: 'bearer' }), {
                    headers: { 'Content-Type': 'application/json' },
                    status: 200
                });
            }

            if (url.endsWith('/ship/v1/shipments')) {
                return new Response(JSON.stringify({
                    errors: [
                        { code: 'SHIPMENT.CREATE.FAILURE', message: 'Invalid request' }
                    ],
                    transactionId: 'mock'
                }), {
                    headers: { 'Content-Type': 'application/json' },
                    status: 200
                });
            }

            throw new Error(`Unexpected fetch URL: ${url}`);
        });

        const fedex = new FedEx({ api_key: 'mock', secret_key: 'mock' });

        await assert.rejects(fedex.createShipment({
            accountNumber: { value: process.env.FEDEX_ACCOUNT_NUMBER },
            labelResponseOptions: 'URL_ONLY',
            requestedShipment: {}
        }), (err) => {
            assert.strictEqual(err.name, 'HttpError');
            return true;
        });
    });

    t.test('should throw HttpError for non 2xx response', async (t) => {
        t.mock.method(globalThis, 'fetch', async (url) => {
            if (url.endsWith('/oauth/token')) {
                return new Response(JSON.stringify({ access_token: 'mock', expires_in: 3600, token_type: 'bearer' }), {
                    headers: { 'Content-Type': 'application/json' },
                    status: 200
                });
            }

            if (url.endsWith('/ship/v1/shipments')) {
                return new Response('', { status: 500, statusText: 'Internal Server Error' });
            }

            throw new Error(`Unexpected fetch URL: ${url}`);
        });

        const fedex = new FedEx({ api_key: 'mock', secret_key: 'mock' });

        await assert.rejects(fedex.createShipment({
            accountNumber: { value: process.env.FEDEX_ACCOUNT_NUMBER },
            labelResponseOptions: 'URL_ONLY',
            requestedShipment: {}
        }), (err) => {
            assert.strictEqual(err.name, 'HttpError');
            assert.match(err.message, /^500/);
            return true;
        });
    });
});

test('getAccessToken', { concurrency: true }, async (t) => {
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

test('groundClose', { concurrency: true }, async (t) => {
    t.test('should close ground shipments', async () => {
        const fedex = new FedEx({
            api_key: process.env.FEDEX_API_KEY,
            secret_key: process.env.FEDEX_SECRET_KEY,
            url: process.env.FEDEX_URL
        });

        const body = await async.retry(async () => fedex.groundClose({
            accountNumber: { value: process.env.FEDEX_ACCOUNT_NUMBER },
            closeDate: new Date().toISOString().slice(0, 10),
            closeReqType: 'GCDR',
            groundServiceCategory: 'GROUND'
        }));

        assert(body);
        assert(body.transactionId);
    });
});

test('groundClose (mocked)', async (t) => {
    t.test('should forward close request body verbatim', async (t) => {
        let sentBody;

        t.mock.method(globalThis, 'fetch', async (url, init) => {
            if (url.endsWith('/oauth/token')) {
                return new Response(JSON.stringify({ access_token: 'mock', expires_in: 3600, token_type: 'bearer' }), {
                    headers: { 'Content-Type': 'application/json' },
                    status: 200
                });
            }

            if (url.endsWith('/ship/v1/endofday/')) {
                sentBody = JSON.parse(init.body);
                return new Response(JSON.stringify({ output: { closeDocuments: [] }, transactionId: 'mock' }), {
                    headers: { 'Content-Type': 'application/json' },
                    status: 200
                });
            }

            throw new Error(`Unexpected fetch URL: ${url}`);
        });

        const fedex = new FedEx({ api_key: 'mock', secret_key: 'mock' });

        await fedex.groundClose({
            accountNumber: { value: '123456789' },
            closeDate: '2026-05-14',
            closeReqType: 'GCDR',
            groundServiceCategory: 'GROUND'
        });

        assert.deepStrictEqual(sentBody, {
            accountNumber: { value: '123456789' },
            closeDate: '2026-05-14',
            closeReqType: 'GCDR',
            groundServiceCategory: 'GROUND'
        });
    });

    t.test('should send options.customer_transaction_id as x-customer-transaction-id header and use PUT method', async (t) => {
        let sentHeader;
        let sentMethod;

        t.mock.method(globalThis, 'fetch', async (url, init) => {
            if (url.endsWith('/oauth/token')) {
                return new Response(JSON.stringify({ access_token: 'mock', expires_in: 3600, token_type: 'bearer' }), {
                    headers: { 'Content-Type': 'application/json' },
                    status: 200
                });
            }

            if (url.endsWith('/ship/v1/endofday/')) {
                sentHeader = init.headers['x-customer-transaction-id'];
                sentMethod = init.method;
                return new Response(JSON.stringify({ output: { closeDocuments: [] }, transactionId: 'mock' }), {
                    headers: { 'Content-Type': 'application/json' },
                    status: 200
                });
            }

            throw new Error(`Unexpected fetch URL: ${url}`);
        });

        const fedex = new FedEx({ api_key: 'mock', secret_key: 'mock' });

        await fedex.groundClose({
            accountNumber: { value: process.env.FEDEX_ACCOUNT_NUMBER },
            closeDate: '2026-05-14',
            closeReqType: 'GCDR',
            groundServiceCategory: 'GROUND'
        }, { customer_transaction_id: 'abc-123' });

        assert.strictEqual(sentHeader, 'abc-123');
        assert.strictEqual(sentMethod, 'PUT');
    });

    t.test('should throw HttpError for 200 response with errors envelope', async (t) => {
        t.mock.method(globalThis, 'fetch', async (url) => {
            if (url.endsWith('/oauth/token')) {
                return new Response(JSON.stringify({ access_token: 'mock', expires_in: 3600, token_type: 'bearer' }), {
                    headers: { 'Content-Type': 'application/json' },
                    status: 200
                });
            }

            if (url.endsWith('/ship/v1/endofday/')) {
                return new Response(JSON.stringify({
                    errors: [
                        { code: 'CLOSE.FAILURE', message: 'No shipments to close' }
                    ],
                    transactionId: 'mock'
                }), {
                    headers: { 'Content-Type': 'application/json' },
                    status: 200
                });
            }

            throw new Error(`Unexpected fetch URL: ${url}`);
        });

        const fedex = new FedEx({ api_key: 'mock', secret_key: 'mock' });

        await assert.rejects(fedex.groundClose({
            accountNumber: { value: process.env.FEDEX_ACCOUNT_NUMBER },
            closeDate: '2026-05-14',
            closeReqType: 'GCDR',
            groundServiceCategory: 'GROUND'
        }), (err) => {
            assert.strictEqual(err.name, 'HttpError');
            return true;
        });
    });

    t.test('should throw HttpError for non 2xx response', async (t) => {
        t.mock.method(globalThis, 'fetch', async (url) => {
            if (url.endsWith('/oauth/token')) {
                return new Response(JSON.stringify({ access_token: 'mock', expires_in: 3600, token_type: 'bearer' }), {
                    headers: { 'Content-Type': 'application/json' },
                    status: 200
                });
            }

            if (url.endsWith('/ship/v1/endofday/')) {
                return new Response('', { status: 500, statusText: 'Internal Server Error' });
            }

            throw new Error(`Unexpected fetch URL: ${url}`);
        });

        const fedex = new FedEx({ api_key: 'mock', secret_key: 'mock' });

        await assert.rejects(fedex.groundClose({
            accountNumber: { value: process.env.FEDEX_ACCOUNT_NUMBER },
            closeDate: '2026-05-14',
            closeReqType: 'GCDR',
            groundServiceCategory: 'GROUND'
        }), (err) => {
            assert.strictEqual(err.name, 'HttpError');
            assert.match(err.message, /^500/);
            return true;
        });
    });
});

test('rateAndTransitTimes', { concurrency: true }, async (t) => {
    t.test('should return rate quotes for a Ground shipment', async () => {
        const fedex = new FedEx({
            api_key: process.env.FEDEX_API_KEY,
            secret_key: process.env.FEDEX_SECRET_KEY,
            url: process.env.FEDEX_URL
        });

        const body = await async.retry(async () => fedex.rateAndTransitTimes({
            accountNumber: { value: process.env.FEDEX_ACCOUNT_NUMBER },
            requestedShipment: {
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
                    weight: { units: 'LB', value: 5 }
                }],
                serviceType: 'FEDEX_GROUND',
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
            }
        }));

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

        const body = await async.retry(async () => fedex.rateAndTransitTimes({
            accountNumber: { value: process.env.FEDEX_ACCOUNT_NUMBER },
            requestedShipment: {
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
                    weight: { units: 'LB', value: 0.5 }
                }],
                serviceType: 'SMART_POST',
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
                smartPostInfoDetail: {
                    ancillaryEndorsement: 'ADDRESS_CORRECTION',
                    hubId: process.env.FEDEX_SMART_POST_HUB_ID,
                    indicia: 'PRESORTED_STANDARD'
                },
                totalPackageCount: 1
            }
        }));

        assert(body);
        assert(body.transactionId);
        assert(body.output);
        assert(Array.isArray(body.output.rateReplyDetails));
    });
});

test('rateAndTransitTimes (mocked)', async (t) => {
    t.test('should send options.customer_transaction_id as x-customer-transaction-id header', async (t) => {
        let sentHeader;

        t.mock.method(globalThis, 'fetch', async (url, init) => {
            if (url.endsWith('/oauth/token')) {
                return new Response(JSON.stringify({ access_token: 'mock', expires_in: 3600, token_type: 'bearer' }), {
                    headers: { 'Content-Type': 'application/json' },
                    status: 200
                });
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

        const fedex = new FedEx({ api_key: 'mock', secret_key: 'mock' });

        await fedex.rateAndTransitTimes({
            accountNumber: { value: process.env.FEDEX_ACCOUNT_NUMBER },
            requestedShipment: {
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
                    weight: { units: 'LB', value: 5 }
                }],
                serviceType: 'FEDEX_GROUND',
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
            }
        }, { customer_transaction_id: 'abc-123' });

        assert.strictEqual(sentHeader, 'abc-123');
    });

    t.test('should throw HttpError for 200 response with errors envelope', async (t) => {
        t.mock.method(globalThis, 'fetch', async (url) => {
            if (url.endsWith('/oauth/token')) {
                return new Response(JSON.stringify({ access_token: 'mock', expires_in: 3600, token_type: 'bearer' }), {
                    headers: { 'Content-Type': 'application/json' },
                    status: 200
                });
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

        const fedex = new FedEx({ api_key: 'mock', secret_key: 'mock' });

        await assert.rejects(fedex.rateAndTransitTimes({
            accountNumber: { value: process.env.FEDEX_ACCOUNT_NUMBER },
            requestedShipment: {
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
                    weight: { units: 'LB', value: 5 }
                }],
                serviceType: 'FEDEX_GROUND',
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
            }
        }), (err) => {
            assert.strictEqual(err.name, 'HttpError');
            return true;
        });
    });

    t.test('should throw HttpError for non 2xx response', async (t) => {
        t.mock.method(globalThis, 'fetch', async (url) => {
            if (url.endsWith('/oauth/token')) {
                return new Response(JSON.stringify({ access_token: 'mock', expires_in: 3600, token_type: 'bearer' }), {
                    headers: { 'Content-Type': 'application/json' },
                    status: 200
                });
            }

            if (url.endsWith('/rate/v1/rates/quotes')) {
                return new Response('', { status: 500, statusText: 'Internal Server Error' });
            }

            throw new Error(`Unexpected fetch URL: ${url}`);
        });

        const fedex = new FedEx({ api_key: 'mock', secret_key: 'mock' });

        await assert.rejects(fedex.rateAndTransitTimes({
            accountNumber: { value: process.env.FEDEX_ACCOUNT_NUMBER },
            requestedShipment: {
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
                    weight: { units: 'LB', value: 5 }
                }],
                serviceType: 'FEDEX_GROUND',
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
            }
        }), (err) => {
            assert.strictEqual(err.name, 'HttpError');
            assert.match(err.message, /^500/);
            return true;
        });
    });
});

test('validateAddress', { concurrency: true }, async (t) => {
    t.test('should return resolved addresses', async () => {
        const fedex = new FedEx({
            api_key: process.env.FEDEX_API_KEY,
            secret_key: process.env.FEDEX_SECRET_KEY,
            url: process.env.FEDEX_URL
        });

        const body = await async.retry(async () => fedex.validateAddress({
            addressesToValidate: [{
                address: {
                    city: 'Chicago',
                    countryCode: 'US',
                    postalCode: '60639',
                    stateOrProvinceCode: 'IL',
                    streetLines: ['5132 W Altgeld St']
                }
            }]
        }));

        assert(body.transactionId);
        assert(Array.isArray(body.output.resolvedAddresses));
    });
});

test('validateAddress (mocked)', async (t) => {
    t.test('should return BUSINESS for a business address', async (t) => {
        t.mock.method(globalThis, 'fetch', async (url) => {
            if (url.endsWith('/oauth/token')) {
                return new Response(JSON.stringify({ access_token: 'mock', expires_in: 3600, token_type: 'bearer' }), {
                    headers: { 'Content-Type': 'application/json' },
                    status: 200
                });
            }

            if (url.endsWith('/address/v1/addresses/resolve')) {
                return new Response(JSON.stringify({
                    transactionId: 'ed813769-626d-4fa7-93c2-caebe3d36dc0',
                    output: {
                        resolvedAddresses: [
                            {
                                streetLinesToken: [
                                    '1950 PARKER RD'
                                ],
                                city: 'CARROLLTON',
                                stateOrProvinceCode: 'TX',
                                postalCode: '75010-4735',
                                parsedPostalCode: {
                                    base: '75010',
                                    addOn: '4735',
                                    deliveryPoint: '50'
                                },
                                countryCode: 'US',
                                classification: 'BUSINESS',
                                ruralRouteHighwayContract: false,
                                generalDelivery: false,
                                customerMessages: [],
                                normalizedStatusNameDPV: true,
                                standardizedStatusNameMatchSource: 'Postal',
                                resolutionMethodName: 'USPS_VALIDATE',
                                attributes: {
                                    POBox: 'false',
                                    POBoxOnlyZIP: 'false',
                                    SplitZIP: 'false',
                                    SuiteRequiredButMissing: 'false',
                                    InvalidSuiteNumber: 'false',
                                    ResolutionInput: 'RAW_ADDRESS',
                                    DPV: 'true',
                                    ResolutionMethod: 'USPS_VALIDATE',
                                    DataVintage: 'January 2017',
                                    MatchSource: 'Postal',
                                    CountrySupported: 'true',
                                    ValidlyFormed: 'true',
                                    Matched: 'true',
                                    Resolved: 'true',
                                    Inserted: 'false',
                                    MultiUnitBase: 'true',
                                    ZIP11Match: 'true',
                                    ZIP4Match: 'true',
                                    UniqueZIP: 'false',
                                    StreetAddress: 'true',
                                    RRConversion: 'false',
                                    ValidMultiUnit: 'false',
                                    AddressType: 'STANDARDIZED',
                                    AddressPrecision: 'STREET_ADDRESS',
                                    MultipleMatches: 'false'
                                }
                            }
                        ]
                    }
                }), {
                    headers: { 'Content-Type': 'application/json' },
                    status: 200
                });
            }

            throw new Error(`Unexpected fetch URL: ${url}`);
        });

        const fedex = new FedEx({ api_key: 'mock', secret_key: 'mock' });

        const body = await fedex.validateAddress({
            addressesToValidate: [{
                address: {
                    city: 'Carrollton',
                    countryCode: 'US',
                    postalCode: '75010',
                    stateOrProvinceCode: 'TX',
                    streetLines: ['1950 Parker Road']
                }
            }]
        });

        const resolved = body.output.resolvedAddresses[0];

        assert.strictEqual(resolved.classification, 'BUSINESS');
        assert.strictEqual(resolved.attributes.Resolved, 'true');
    });

    t.test('should return MIXED for a mixed-use address', async (t) => {
        t.mock.method(globalThis, 'fetch', async (url) => {
            if (url.endsWith('/oauth/token')) {
                return new Response(JSON.stringify({ access_token: 'mock', expires_in: 3600, token_type: 'bearer' }), {
                    headers: { 'Content-Type': 'application/json' },
                    status: 200
                });
            }

            if (url.endsWith('/address/v1/addresses/resolve')) {
                return new Response(JSON.stringify({
                    transactionId: '24f1dd06-e1fd-4cbf-b8dd-de85312d44e8',
                    output: {
                        resolvedAddresses: [
                            {
                                streetLinesToken: [
                                    '75 SPRING ST'
                                ],
                                city: 'NEW YORK',
                                stateOrProvinceCode: 'NY',
                                postalCode: '10012-4020',
                                parsedPostalCode: {
                                    base: '10012',
                                    addOn: '4020',
                                    deliveryPoint: '99'
                                },
                                countryCode: 'US',
                                classification: 'MIXED',
                                ruralRouteHighwayContract: false,
                                generalDelivery: false,
                                customerMessages: [],
                                normalizedStatusNameDPV: false,
                                standardizedStatusNameMatchSource: 'Postal',
                                resolutionMethodName: 'USPS_VALIDATE',
                                attributes: {
                                    POBox: 'false',
                                    POBoxOnlyZIP: 'false',
                                    SplitZIP: 'false',
                                    SuiteRequiredButMissing: 'true',
                                    InvalidSuiteNumber: 'false',
                                    ResolutionInput: 'RAW_ADDRESS',
                                    DPV: 'false',
                                    ResolutionMethod: 'USPS_VALIDATE',
                                    DataVintage: 'May 2017',
                                    MatchSource: 'Postal',
                                    CountrySupported: 'true',
                                    ValidlyFormed: 'true',
                                    Matched: 'true',
                                    Resolved: 'true',
                                    Inserted: 'false',
                                    MultiUnitBase: 'true',
                                    ZIP11Match: 'true',
                                    ZIP4Match: 'true',
                                    UniqueZIP: 'false',
                                    StreetAddress: 'false',
                                    RRConversion: 'false',
                                    ValidMultiUnit: 'false',
                                    AddressType: 'STANDARDIZED',
                                    AddressPrecision: 'MULTI_TENANT_BASE',
                                    MultipleMatches: 'false'
                                }
                            }
                        ]
                    }
                }), {
                    headers: { 'Content-Type': 'application/json' },
                    status: 200
                });
            }

            throw new Error(`Unexpected fetch URL: ${url}`);
        });

        const fedex = new FedEx({ api_key: 'mock', secret_key: 'mock' });

        const body = await fedex.validateAddress({
            addressesToValidate: [{
                address: {
                    city: 'New York',
                    countryCode: 'US',
                    postalCode: '10012',
                    stateOrProvinceCode: 'NY',
                    streetLines: ['75 Spring St']
                }
            }]
        });

        const resolved = body.output.resolvedAddresses[0];

        assert.strictEqual(resolved.classification, 'MIXED');
        assert.strictEqual(resolved.attributes.Resolved, 'true');
    });

    t.test('should return RESIDENTIAL for a residential address', async (t) => {
        t.mock.method(globalThis, 'fetch', async (url) => {
            if (url.endsWith('/oauth/token')) {
                return new Response(JSON.stringify({ access_token: 'mock', expires_in: 3600, token_type: 'bearer' }), {
                    headers: { 'Content-Type': 'application/json' },
                    status: 200
                });
            }

            if (url.endsWith('/address/v1/addresses/resolve')) {
                return new Response(JSON.stringify({
                    transactionId: 'a538c6e8-9b78-45a4-a415-b2e53f19d930',
                    output: {
                        resolvedAddresses: [
                            {
                                streetLinesToken: [
                                    '5132 W ALTGELD ST'
                                ],
                                city: 'CHICAGO',
                                stateOrProvinceCode: 'IL',
                                postalCode: '60639-2402',
                                parsedPostalCode: {
                                    base: '60639',
                                    addOn: '2402',
                                    deliveryPoint: '32'
                                },
                                countryCode: 'US',
                                classification: 'RESIDENTIAL',
                                ruralRouteHighwayContract: false,
                                generalDelivery: false,
                                customerMessages: [],
                                normalizedStatusNameDPV: true,
                                standardizedStatusNameMatchSource: 'Postal',
                                resolutionMethodName: 'USPS_VALIDATE',
                                attributes: {
                                    POBox: 'false',
                                    POBoxOnlyZIP: 'false',
                                    SplitZIP: 'false',
                                    SuiteRequiredButMissing: 'false',
                                    InvalidSuiteNumber: 'false',
                                    ResolutionInput: 'RAW_ADDRESS',
                                    DPV: 'true',
                                    ResolutionMethod: 'USPS_VALIDATE',
                                    DataVintage: 'May 2017',
                                    MatchSource: 'Postal',
                                    CountrySupported: 'true',
                                    ValidlyFormed: 'true',
                                    Matched: 'true',
                                    Resolved: 'true',
                                    Inserted: 'false',
                                    MultiUnitBase: 'false',
                                    ZIP11Match: 'true',
                                    ZIP4Match: 'true',
                                    UniqueZIP: 'false',
                                    StreetAddress: 'true',
                                    RRConversion: 'false',
                                    ValidMultiUnit: 'false',
                                    AddressType: 'STANDARDIZED',
                                    AddressPrecision: 'STREET_ADDRESS',
                                    MultipleMatches: 'false'
                                }
                            }
                        ]
                    }
                }), {
                    headers: { 'Content-Type': 'application/json' },
                    status: 200
                });
            }

            throw new Error(`Unexpected fetch URL: ${url}`);
        });

        const fedex = new FedEx({ api_key: 'mock', secret_key: 'mock' });

        const body = await fedex.validateAddress({
            addressesToValidate: [{
                address: {
                    city: 'Chicago',
                    countryCode: 'US',
                    postalCode: '60639',
                    stateOrProvinceCode: 'IL',
                    streetLines: ['5132 W Altgeld St']
                }
            }]
        });

        const resolved = body.output.resolvedAddresses[0];

        assert.strictEqual(resolved.classification, 'RESIDENTIAL');
        assert.strictEqual(resolved.attributes.Resolved, 'true');
    });

    t.test('should return Resolved: false for a non-deliverable address', async (t) => {
        t.mock.method(globalThis, 'fetch', async (url) => {
            if (url.endsWith('/oauth/token')) {
                return new Response(JSON.stringify({ access_token: 'mock', expires_in: 3600, token_type: 'bearer' }), {
                    headers: { 'Content-Type': 'application/json' },
                    status: 200
                });
            }

            if (url.endsWith('/address/v1/addresses/resolve')) {
                return new Response(JSON.stringify({
                    transactionId: '577df10d-c0fa-4c34-b7a9-e3a4520204f9',
                    output: {
                        resolvedAddresses: [
                            {
                                streetLinesToken: [
                                    '9999 IMAGINARY WAY'
                                ],
                                city: 'CHICAGO',
                                stateOrProvinceCode: 'IL',
                                postalCode: '60639',
                                countryCode: 'US',
                                classification: 'UNKNOWN',
                                ruralRouteHighwayContract: false,
                                generalDelivery: false,
                                customerMessages: [
                                    {
                                        code: 'STANDARDIZED.ADDRESS.NOTFOUND',
                                        message: 'Standardized address is not found.'
                                    }
                                ],
                                attributes: {
                                    SuiteRequiredButMissing: 'false',
                                    PostalValidated: 'true',
                                    InvalidSuiteNumber: 'false',
                                    ZIP11Match: 'false',
                                    GeneralDelivery: 'false',
                                    DPV: 'false',
                                    DataVintage: 'March 2026',
                                    ZIP4Match: 'false',
                                    CityStateValidated: 'true',
                                    CountrySupported: 'true',
                                    ValidlyFormed: 'true',
                                    Matched: 'false',
                                    StreetValidated: 'false',
                                    MissingOrAmbiguousDirectional: 'false',
                                    Resolved: 'false',
                                    StreetRangeValidated: 'false',
                                    AddressType: 'NORMALIZED',
                                    Inserted: 'true',
                                    MultipleMatches: 'false'
                                }
                            }
                        ]
                    }
                }), {
                    headers: { 'Content-Type': 'application/json' },
                    status: 200
                });
            }

            throw new Error(`Unexpected fetch URL: ${url}`);
        });

        const fedex = new FedEx({ api_key: 'mock', secret_key: 'mock' });

        const body = await fedex.validateAddress({
            addressesToValidate: [{
                address: {
                    city: 'Chicago',
                    countryCode: 'US',
                    postalCode: '60639',
                    stateOrProvinceCode: 'IL',
                    streetLines: ['9999 Imaginary Way']
                }
            }]
        });

        const resolved = body.output.resolvedAddresses[0];

        assert.strictEqual(resolved.classification, 'UNKNOWN');
        assert.strictEqual(resolved.attributes.Resolved, 'false');
    });

    t.test('should return UNKNOWN for an unclassified address', async (t) => {
        t.mock.method(globalThis, 'fetch', async (url) => {
            if (url.endsWith('/oauth/token')) {
                return new Response(JSON.stringify({ access_token: 'mock', expires_in: 3600, token_type: 'bearer' }), {
                    headers: { 'Content-Type': 'application/json' },
                    status: 200
                });
            }

            if (url.endsWith('/address/v1/addresses/resolve')) {
                return new Response(JSON.stringify({
                    transactionId: '1d083f8b-65f9-454f-b9bf-20bba66e2a16',
                    output: {
                        resolvedAddresses: [
                            {
                                streetLinesToken: [
                                    '1 CROWHEART DR'
                                ],
                                city: 'CROWHEART',
                                stateOrProvinceCode: 'WY',
                                postalCode: '82512-5011',
                                parsedPostalCode: {
                                    base: '82512',
                                    addOn: '5011',
                                    deliveryPoint: '01'
                                },
                                countryCode: 'US',
                                classification: 'UNKNOWN',
                                ruralRouteHighwayContract: false,
                                generalDelivery: false,
                                customerMessages: [
                                    {
                                        code: 'INTERPOLATED.STREET.ADDRESS',
                                        message: 'Unable to confirm exact street number for the entered street name. The address falls within a valid range for the street name.'
                                    }
                                ],
                                standardizedStatusNameMatchSource: 'Map',
                                resolutionMethodName: 'TELEATLAS_GEO_VALIDATE',
                                attributes: {
                                    POBox: 'false',
                                    MultiUnitBase: 'false',
                                    Intersection: 'false',
                                    SuiteRequiredButMissing: 'false',
                                    InvalidSuiteNumber: 'false',
                                    ResolutionInput: 'RAW_ADDRESS',
                                    ZIP11Match: 'true',
                                    ResolutionMethod: 'TELEATLAS_GEO_VALIDATE',
                                    DataVintage: 'MARCH 2026',
                                    ZIP4Match: 'true',
                                    StreetRange: 'false',
                                    UniqueZIP: 'false',
                                    MatchSource: 'Map',
                                    CountrySupported: 'true',
                                    Matched: 'true',
                                    RRConversion: 'false',
                                    ValidMultiUnit: 'false',
                                    Resolved: 'true',
                                    AddressType: 'STANDARDIZED',
                                    Inserted: 'true',
                                    InterpolatedStreetAddress: 'true'
                                }
                            }
                        ]
                    }
                }), {
                    headers: { 'Content-Type': 'application/json' },
                    status: 200
                });
            }

            throw new Error(`Unexpected fetch URL: ${url}`);
        });

        const fedex = new FedEx({ api_key: 'mock', secret_key: 'mock' });

        const body = await fedex.validateAddress({
            addressesToValidate: [{
                address: {
                    city: 'Crowheart',
                    countryCode: 'US',
                    postalCode: '82512',
                    stateOrProvinceCode: 'WY',
                    streetLines: ['1 Crow Heart Rd']
                }
            }]
        });

        const resolved = body.output.resolvedAddresses[0];

        assert.strictEqual(resolved.classification, 'UNKNOWN');
        assert.strictEqual(resolved.attributes.Resolved, 'true');
    });

    t.test('should send options.customer_transaction_id as x-customer-transaction-id header', async (t) => {
        let sentHeader;

        t.mock.method(globalThis, 'fetch', async (url, init) => {
            if (url.endsWith('/oauth/token')) {
                return new Response(JSON.stringify({ access_token: 'mock', expires_in: 3600, token_type: 'bearer' }), {
                    headers: { 'Content-Type': 'application/json' },
                    status: 200
                });
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

        const fedex = new FedEx({ api_key: 'mock', secret_key: 'mock' });

        await fedex.validateAddress({
            addressesToValidate: [{
                address: {
                    city: 'New York',
                    countryCode: 'US',
                    postalCode: '10118',
                    stateOrProvinceCode: 'NY',
                    streetLines: ['350 5th Ave']
                }
            }]
        }, { customer_transaction_id: 'abc-123' });

        assert.strictEqual(sentHeader, 'abc-123');
    });

    t.test('should throw HttpError for 200 response with errors envelope', async (t) => {
        t.mock.method(globalThis, 'fetch', async (url) => {
            if (url.endsWith('/oauth/token')) {
                return new Response(JSON.stringify({ access_token: 'mock', expires_in: 3600, token_type: 'bearer' }), {
                    headers: { 'Content-Type': 'application/json' },
                    status: 200
                });
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

        const fedex = new FedEx({ api_key: 'mock', secret_key: 'mock' });

        await assert.rejects(fedex.validateAddress({
            addressesToValidate: [{
                address: {
                    city: 'New York',
                    countryCode: 'US',
                    postalCode: '10118',
                    stateOrProvinceCode: 'NY',
                    streetLines: ['350 5th Ave']
                }
            }]
        }), (err) => {
            assert.strictEqual(err.name, 'HttpError');
            return true;
        });
    });

    t.test('should throw HttpError for non 2xx response', async (t) => {
        t.mock.method(globalThis, 'fetch', async (url) => {
            if (url.endsWith('/oauth/token')) {
                return new Response(JSON.stringify({ access_token: 'mock', expires_in: 3600, token_type: 'bearer' }), {
                    headers: { 'Content-Type': 'application/json' },
                    status: 200
                });
            }

            if (url.endsWith('/address/v1/addresses/resolve')) {
                return new Response('', { status: 500, statusText: 'Internal Server Error' });
            }

            throw new Error(`Unexpected fetch URL: ${url}`);
        });

        const fedex = new FedEx({ api_key: 'mock', secret_key: 'mock' });

        await assert.rejects(fedex.validateAddress({
            addressesToValidate: [{
                address: {
                    city: 'New York',
                    countryCode: 'US',
                    postalCode: '10118',
                    stateOrProvinceCode: 'NY',
                    streetLines: ['350 5th Ave']
                }
            }]
        }), (err) => {
            assert.strictEqual(err.name, 'HttpError');
            assert.match(err.message, /^500/);
            return true;
        });
    });
});

const assert = require('node:assert');
const test = require('node:test');

const FedEx = require('../index');

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
            account_number: process.env.FEDEX_ACCOUNT_NUMBER,
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
            account_number: process.env.FEDEX_ACCOUNT_NUMBER,
            api_key: process.env.FEDEX_API_KEY,
            secret_key: process.env.FEDEX_SECRET_KEY,
            url: process.env.FEDEX_URL
        });

        const accessToken1 = await fedex.getAccessToken();
        const accessToken2 = await fedex.getAccessToken();

        assert.deepStrictEqual(accessToken2, accessToken1);
    });
});

test('rates', { concurrency: true }, async (t) => {
    t.test('should return rate quotes for a valid shipment', async () => {
        const fedex = new FedEx({
            account_number: process.env.FEDEX_ACCOUNT_NUMBER,
            api_key: process.env.FEDEX_API_KEY,
            secret_key: process.env.FEDEX_SECRET_KEY,
            url: process.env.FEDEX_URL
        });

        const body = await fedex.rates({
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
        });

        assert(body);
        assert(body.transactionId);
        assert(body.output);
        assert(Array.isArray(body.output.rateReplyDetails));
    });
});

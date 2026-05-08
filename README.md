# fedex

[![Test](https://github.com/stores-com/fedex/actions/workflows/test.yml/badge.svg)](https://github.com/stores-com/fedex/actions/workflows/test.yml)
[![Coverage Status](https://coveralls.io/repos/github/stores-com/fedex/badge.svg?branch=main)](https://coveralls.io/github/stores-com/fedex?branch=main)
[![npm version](https://img.shields.io/npm/v/@stores.com/fedex)](https://www.npmjs.com/package/@stores.com/fedex)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

FedEx REST API client for OAuth tokens and rate quotes.

## Installation

```
$ npm install @stores.com/fedex
```

## Usage

```javascript
const FedEx = require('@stores.com/fedex');

const fedex = new FedEx({
    account_number: 'your_account_number',
    api_key: 'your_api_key',
    secret_key: 'your_secret_key'
});
```

By default the client targets the production endpoint (`https://apis.fedex.com`). To point at the sandbox, pass `url` explicitly:

```javascript
const fedex = new FedEx({
    account_number: 'your_account_number',
    api_key: 'your_api_key',
    secret_key: 'your_secret_key',
    url: 'https://apis-sandbox.fedex.com'
});
```

## Documentation

- https://developer.fedex.com/api/en-us/home.html

## Methods

### getAccessToken()

FedEx APIs use the OAuth 2.0 protocol for authentication and authorization using the `client_credentials` grant type. Tokens are cached in-process per account number until shortly before they expire.

See: https://developer.fedex.com/api/en-us/catalog/authorization.html

```javascript
const accessToken = await fedex.getAccessToken();

console.log(accessToken);
// {
//     access_token: '...',
//     expires_in: 3600,
//     scope: 'CXS',
//     token_type: 'bearer'
// }
```

### rates(requestedShipment, options)

Request rate quotes for a shipment. The caller supplies only the `requestedShipment` body; the package fills the top-level `accountNumber` and `rateRequestControlParameters` envelope.

See: https://developer.fedex.com/api/en-us/catalog/rate.html

```javascript
const body = await fedex.rates({
    packagingType: 'YOUR_PACKAGING',
    pickupType: 'USE_SCHEDULED_PICKUP',
    recipient: {
        address: { countryCode: 'US', postalCode: '10001' }
    },
    requestedPackageLineItems: [{ weight: { units: 'LB', value: 5 } }],
    serviceType: 'FEDEX_GROUND',
    shipper: {
        address: { countryCode: 'US', postalCode: '38116' }
    }
});

const detail = body.output.rateReplyDetails[0].ratedShipmentDetails[0];

console.log(detail.totalNetCharge);
// 24.17
```

If FedEx returns a 200 response carrying a non-empty `errors[]` envelope, the call rejects with `Error('${code}: ${message}')` from the first entry. Non-2xx responses reject with `HttpError`.

# fedex

[![Test](https://github.com/stores-com/fedex/actions/workflows/test.yml/badge.svg)](https://github.com/stores-com/fedex/actions/workflows/test.yml)
[![Coverage Status](https://coveralls.io/repos/github/stores-com/fedex/badge.svg?branch=main)](https://coveralls.io/github/stores-com/fedex?branch=main)
[![npm version](https://img.shields.io/npm/v/@stores.com/fedex)](https://www.npmjs.com/package/@stores.com/fedex)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

FedEx REST API client for Address Validation, Ground End of Day Close, OAuth tokens, Rates and Transit Times, Shipment Cancellation, Shipment Creation, and Tracking.

## Installation

```
$ npm install @stores.com/fedex
```

## Usage

```javascript
const FedEx = require('@stores.com/fedex');

const fedEx = new FedEx({
    api_key: 'your_api_key',
    secret_key: 'your_secret_key'
});
```

By default the client targets the production endpoint (`https://apis.fedex.com`). To point at the sandbox, pass `url` explicitly:

```javascript
const fedEx = new FedEx({
    api_key: 'your_api_key',
    secret_key: 'your_secret_key',
    url: 'https://apis-sandbox.fedex.com'
});
```

## Documentation

- https://developer.fedex.com/api/en-us/home.html

## Methods

### cancelShipment(cancelRequest, options)

Cancel a FedEx shipment via the Ship API. The caller supplies the full request body — `accountNumber`, `trackingNumber`, `senderCountryCode`, `deletionControl` — and the package forwards it verbatim.

See: https://developer.fedex.com/api/en-us/catalog/ship/v1/docs.html

```javascript
const json = await fedEx.cancelShipment({
    accountNumber: { value: 'your_account_number' },
    deletionControl: 'DELETE_ALL_PACKAGES',
    senderCountryCode: 'US',
    trackingNumber: '794644790138'
});
```

Non-2xx responses reject with `HttpError`. If FedEx returns a 200 response carrying a non-empty `errors[]` envelope, the call rejects with an `HttpError` whose message is every `message` joined by `; ` and whose `.json` is the full response body (with the `errors[]` array, codes, and any other fields).

### createShipment(shipRequest, options)

Create a FedEx shipment via the Ship API. The caller supplies the full request body — `accountNumber`, `labelResponseOptions`, `requestedShipment` — and the package forwards it verbatim.

See: https://developer.fedex.com/api/en-us/catalog/ship/v1/docs.html

```javascript
const json = await fedEx.createShipment({
    accountNumber: { value: 'your_account_number' },
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
        requestedPackageLineItems: [{ weight: { units: 'LB', value: 5 } }],
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
        shippingChargesPayment: { paymentType: 'SENDER' }
    }
});

const trackingNumber = json.output.transactionShipments[0].masterTrackingNumber;

console.log(trackingNumber);
// '794644790138'
```

Non-2xx responses reject with `HttpError`. If FedEx returns a 200 response carrying a non-empty `errors[]` envelope, the call rejects with an `HttpError` whose message is every `message` joined by `; ` and whose `.json` is the full response body (with the `errors[]` array, codes, and any other fields).

### getAccessToken()

FedEx APIs use the OAuth 2.0 protocol for authentication and authorization using the `client_credentials` grant type. Tokens are cached in-process per API key until shortly before they expire.

See: https://developer.fedex.com/api/en-us/catalog/authorization.html

```javascript
const accessToken = await fedEx.getAccessToken();

console.log(accessToken);
// {
//     access_token: '...',
//     expires_in: 3600,
//     scope: 'CXS',
//     token_type: 'bearer'
// }
```

### groundEndOfDayClose(closeRequest, options)

Close out FedEx Ground shipments via the Ground End of Day Close API. The caller supplies the full request body — `accountNumber`, `closeDate`, `closeReqType`, `groundServiceCategory` — and the package forwards it verbatim.

See: https://developer.fedex.com/api/en-us/catalog/close/v1/docs.html

```javascript
const json = await fedEx.groundEndOfDayClose({
    accountNumber: { value: 'your_account_number' },
    closeDate: '2026-05-14',
    closeReqType: 'GCDR',
    groundServiceCategory: 'GROUND'
});
```

Non-2xx responses reject with `HttpError`. If FedEx returns a 200 response carrying a non-empty `errors[]` envelope, the call rejects with an `HttpError` whose message is every `message` joined by `; ` and whose `.json` is the full response body (with the `errors[]` array, codes, and any other fields).

### rateAndTransitTimes(rateRequest, options)

Request rate quotes and transit times from FedEx. The caller supplies the full request body — `accountNumber`, `requestedShipment`, and any of `rateRequestControlParameters`, `carrierCodes`, `processingOptions`, `version` — and the package forwards it verbatim.

See: https://developer.fedex.com/api/en-us/catalog/rate/v1/docs.html

```javascript
const json = await fedEx.rateAndTransitTimes({
    accountNumber: { value: 'your_account_number' },
    rateRequestControlParameters: {
        rateSortOrder: 'SERVICENAMETRADITIONAL',
        returnTransitTime: true,
        servicesNeededOnRateFailure: true
    },
    requestedShipment: {
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
    }
});

const detail = json.output.rateReplyDetails[0].ratedShipmentDetails[0];

console.log(detail.totalNetCharge);
// 24.17
```

Non-2xx responses reject with `HttpError`. If FedEx returns a 200 response carrying a non-empty `errors[]` envelope, the call rejects with an `HttpError` whose message is every `message` joined by `; ` and whose `.json` is the full response body (with the `errors[]` array, codes, and any other fields).

### track(trackRequest, options)

Track a FedEx shipment via the Track API. The caller supplies the full request body — `includeDetailedScans`, `trackingInfo` — and the package forwards it verbatim.

See: https://developer.fedex.com/api/en-us/catalog/track/v1/docs.html

```javascript
const json = await fedex.track({
    includeDetailedScans: true,
    trackingInfo: [{
        trackingNumberInfo: {
            trackingNumber: '794644790138'
        }
    }]
});

const trackResult = json.output.completeTrackResults[0].trackResults[0];

console.log(trackResult.latestStatusDetail.statusByLocale);
// 'Delivered'
```

Non-2xx responses reject with `HttpError`. If FedEx returns a 200 response carrying a non-empty `errors[]` envelope, the call rejects with an `HttpError` whose message is every `message` joined by `; ` and whose `.json` is the full response body (with the `errors[]` array, codes, and any other fields).

### validateAddress(addressValidationRequest, options)

Validate and resolve addresses using the FedEx Address Validation API. The caller supplies the full request body — `addressesToValidate` and optionally `inEffectAsOfTimestamp` — and the package forwards it verbatim.

See: https://developer.fedex.com/api/en-us/catalog/address-validation/v1/docs.html

```javascript
const json = await fedEx.validateAddress({
    addressesToValidate: [{
        address: {
            city: 'New York',
            countryCode: 'US',
            postalCode: '10118',
            stateOrProvinceCode: 'NY',
            streetLines: ['350 5th Ave']
        }
    }]
});

const resolved = json.output.resolvedAddresses[0];

console.log(resolved.classification);
// 'RESIDENTIAL'
```

Non-2xx responses reject with `HttpError`. If FedEx returns a 200 response carrying a non-empty `errors[]` envelope, the call rejects with an `HttpError` whose message is every `message` joined by `; ` and whose `.json` is the full response body (with the `errors[]` array, codes, and any other fields).

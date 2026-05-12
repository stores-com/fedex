# Changelog

## 0.2.0

- Add `validateAddress(addressValidationRequest, options)` — calls the FedEx Address Validation API (`POST /address/v1/addresses/resolve`). Same passthrough pattern as `rateAndTransitTimes`: caller supplies the full request body, the package forwards it verbatim. Supports `options.customer_transaction_id` and `options.timeout` like the other methods. Non-2xx responses and 200-with-`errors[]` envelopes both reject with `HttpError`.

## 0.1.0

- Initial release.
- `new FedEx({ api_key, secret_key, url })` — client constructor.
- `getAccessToken(options)` — OAuth `client_credentials` token, cached in memory per `api_key` for half the token lifetime.
- `rateAndTransitTimes(rateRequest, options)` — calls the FedEx Rates and Transit Times API (`POST /rate/v1/rates/quotes`). Supports `options.customer_transaction_id` and `options.timeout`.

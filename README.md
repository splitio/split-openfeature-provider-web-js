# Split Provider for OpenFeature Web SDK
[![Twitter Follow](https://img.shields.io/twitter/follow/splitsoftware.svg?style=social&label=Follow&maxAge=1529000)](https://twitter.com/intent/follow?screen_name=splitsoftware)

## Overview
This Provider is designed to allow the use of OpenFeature with Split, the platform for controlled rollouts, serving features to your users via the Split feature flag to manage your complete customer experience.

## Compatibility


## Getting started
Below is a simple example that describes the instantiation of the Split Provider for the OpenFeature Web SDK. Please see the [OpenFeature Documentation](https://openfeature.dev/docs/reference/technologies/client/web) for details on how to use the OpenFeature Web SDK.

### Confirm peer dependencies are installed

```sh
npm install @splitsoftware/splitio
npm install @openfeature/web-sdk
```

### Add the Split provider

```sh
npm install @splitsoftware/openfeature-web-split-provider
```

### Register the Split provider with OpenFeature

```js
import { OpenFeature } from '@openfeature/web-sdk';
import { SplitFactory } from '@splitsoftware/splitio';
import { OpenFeatureSplitProvider } from '@splitsoftware/openfeature-web-split-provider';

const authorizationKey = 'your client-side SDK key';
const targetingKey = 'your-targeting-key';

const splitFactory = SplitFactory({
  core: {
    authorizationKey,
    key: targetingKey
  }
});
const provider = new OpenFeatureSplitProvider({splitFactory});

// Wait for the default Split client for 'your-targeting-key' to be ready
await OpenFeature.setProviderAndWait(provider);
```

## Use of OpenFeature with Split
After the initial setup you can use OpenFeature according to their [documentation for OpenFeature Web SDK](https://openfeature.dev/docs/reference/technologies/client/web).

One important note is that, unlike our [OpenFeature Provider for Node.js](https://github.com/splitio/split-openfeature-provider-js), the SplitFactory **requires a targeting key** to be set, which is provided in the `key` property of the `core` configuration object. This key is then used to evaluate flag values.

```js
const client = OpenFeature.getClient();

const boolValue = client.getBooleanValue('boolFlag', false);
```

If a different targeting key is required, the evaluation context may be set using the `OpenFeature.setContext` method:
```js
const context: EvaluationContext = {
  targetingKey: 'new-targeting-key',
};

// Wait for 'new-targeting-key' to be ready. Internally this will replace the current Split client for the provided key
await OpenFeature.setContext(context)

// Evaluate flags for 'new-targeting-key'
const boolValue = client.getBooleanValue('boolFlag', false);
```

## Submitting issues

The Split team monitors all issues submitted to this [issue tracker](https://github.com/splitio/split-openfeature-provider-web-js/issues). We encourage you to use this issue tracker to submit any bug reports, feedback, and feature enhancements. We'll do our best to respond in a timely manner.

## Contributing
Please see [Contributors Guide](CONTRIBUTORS-GUIDE.md) to find all you need to submit a Pull Request (PR).

## License
Licensed under the Apache License, Version 2.0. See: [Apache License](http://www.apache.org/licenses/).

## About Split

Split is the leading Feature Delivery Platform for engineering teams that want to confidently deploy features as fast as they can develop them. Split’s fine-grained management, real-time monitoring, and data-driven experimentation ensure that new features will improve the customer experience without breaking or degrading performance. Companies like Twilio, Salesforce, GoDaddy and WePay trust Split to power their feature delivery.

To learn more about Split, contact hello@split.io, or get started with feature flags for free at https://www.split.io/signup.

Split has built and maintains SDKs for:

* Java [Github](https://github.com/splitio/java-client) [Docs](https://help.split.io/hc/en-us/articles/360020405151-Java-SDK)
* Javascript [Github](https://github.com/splitio/javascript-client) [Docs](https://help.split.io/hc/en-us/articles/360020448791-JavaScript-SDK)
* Node [Github](https://github.com/splitio/javascript-client) [Docs](https://help.split.io/hc/en-us/articles/360020564931-Node-js-SDK)
* .NET [Github](https://github.com/splitio/dotnet-client) [Docs](https://help.split.io/hc/en-us/articles/360020240172--NET-SDK)
* Ruby [Github](https://github.com/splitio/ruby-client) [Docs](https://help.split.io/hc/en-us/articles/360020673251-Ruby-SDK)
* PHP [Github](https://github.com/splitio/php-client) [Docs](https://help.split.io/hc/en-us/articles/360020350372-PHP-SDK)
* Python [Github](https://github.com/splitio/python-client) [Docs](https://help.split.io/hc/en-us/articles/360020359652-Python-SDK)
* GO [Github](https://github.com/splitio/go-client) [Docs](https://help.split.io/hc/en-us/articles/360020093652-Go-SDK)
* Android [Github](https://github.com/splitio/android-client) [Docs](https://help.split.io/hc/en-us/articles/360020343291-Android-SDK)
* iOS [Github](https://github.com/splitio/ios-client) [Docs](https://help.split.io/hc/en-us/articles/360020401491-iOS-SDK)

For a comprehensive list of open source projects visit our [Github page](https://github.com/splitio?utf8=%E2%9C%93&query=%20only%3Apublic%20).

**Learn more about Split:**

Visit [split.io/product](https://www.split.io/product) for an overview of Split, or visit our documentation at [help.split.io](http://help.split.io) for more detailed information.

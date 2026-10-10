# Privacy policy for Country Flag Fixer

Last updated: October 10, 2026.

Country Flag Fixer is a Chrome and Microsoft Edge extension. Its purpose is to display supported flag emoji correctly and let users disable flag fixing on selected websites.

## Website content and addresses

The extension processes text in web pages locally to identify flag sequences and adjust their font. It uses page and frame URLs to determine whether a website is excluded, and the toolbar popup uses the current website's hostname to display and manage its exclusion.

Page text and browsing history are not saved or sent to the developer. The extension does not build a record of visited websites. Website content and addresses are used only to provide flag rendering and website exclusions.

## Saved settings

The extension stores user-selected excluded hostnames and an identifier for each exclusion in the browser's `chrome.storage.sync` storage. These settings persist between browser sessions and may synchronize across devices through the browser provider's synchronization service, depending on the user's browser settings. Paths and complete page URLs are not stored as exclusions. Synchronization is governed by the browser provider's privacy policy and settings.

The extension also stores a version marker in `chrome.storage.local` to remember whether the update notice has already been shown on that device. This marker is not synchronized by the extension.

## Sharing and other uses

The extension does **not** send user data to the developer or operate a developer-controlled data collection service. It contains no analytics, advertising or tracking functionality. The flag font is bundled with the extension rather than downloaded from an external font service.

User data is not sold, used for advertising or profiling, or used to determine creditworthiness or for lending purposes. Apart from browser-managed synchronization of excluded websites, the extension does not transmit this information to third parties.

Country Flag Fixer's use of user data complies with the Chrome Web Store User Data Policy, including its Limited Use requirements. Data is used only for the extension's stated purpose and user-facing features.

## Managing and deleting settings

Users can view and remove excluded websites in the extension's Settings page. Removing an entry also updates the extension's sync storage. Browser settings control whether extension settings are synchronized between devices. The local update-notice marker remains until the extension's local storage is cleared, such as when the extension is uninstalled. Uninstalling does not necessarily remove copies retained by the browser's synchronization service; consult the browser provider's settings for managing synchronized data.

## Changes and contact

This policy will be updated if the extension's data handling changes. Questions or concerns can be submitted through the [project's GitHub issues](https://github.com/matthijs110/chromium-country-flags/issues). Issues are public; please do not include private browsing information or other sensitive data.

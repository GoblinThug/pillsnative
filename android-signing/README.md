# Android signing for sideloaded APKs

Stable keystore so GitHub Releases APKs can update over previous installs.

- `pillsnative.keystore` — PKCS12 keystore (committed on purpose for this open sideload app)
- `keystore.properties` — passwords/alias used by `scripts/configure-android-signing.js`

Do not rotate this key casually: users would need to uninstall to install a new signature.

# Aikido intel

We use the information available from Aikido at https://malware-list.aikido.dev/
Aikido intel is opensource licensed under AGPL.

It took me some time to understand if these endpoints are covered by the license. Their safe-chain README.md [says](https://github.com/AikidoSec/safe-chain/blob/da9e3d475e4a9be98d16e835d092fab2bcd6d8eb/README.md?plain=1#L112) that safechain uses the aikido open source intel. Digging through [their source](https://github.com/AikidoSec/safe-chain/blob/da9e3d475e4a9be98d16e835d092fab2bcd6d8eb/packages/safe-chain/src/config/settings.js#L233) we can see that the URL is the makware-list.aikido.dev url, which means that those endpoints are covered by the AGPL license.

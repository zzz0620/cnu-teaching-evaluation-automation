# Third-Party Notices

本项目源代码和独立发行文件使用以下第三方组件。其版权和许可归各自权利人所有。

| Component | Purpose | License / Source |
| --- | --- | --- |
| Node.js | JavaScript runtime and SEA executable | MIT and bundled third-party notices, <https://github.com/nodejs/node> |
| Playwright Core | Microsoft Edge browser automation | Apache-2.0, <https://github.com/microsoft/playwright> |
| Chromium BiDi | BiDi protocol support used by Playwright bundle | Apache-2.0, <https://github.com/GoogleChromeLabs/chromium-bidi> |
| esbuild | Build-time JavaScript bundling | MIT, <https://github.com/evanw/esbuild> |
| postject | Build-time SEA resource injection | MIT, <https://github.com/nodejs/postject> |
| mitt | Chromium BiDi event emitter dependency | MIT, <https://github.com/developit/mitt> |
| URLPattern polyfill | Chromium BiDi URL pattern dependency | MIT, <https://github.com/kenchris/urlpattern-polyfill> |
| Zod | Chromium BiDi schema validation dependency | MIT, <https://github.com/colinhacks/zod> |
| Chrome DevTools Protocol definitions | Chromium BiDi protocol dependency | BSD-3-Clause, <https://github.com/ChromeDevTools/devtools-protocol> |

各组件随附许可证位于 `third_party_licenses/`。Microsoft Edge 不随本项目分发，用户需自行安装并遵守其许可条款。依赖的精确版本记录在 `package-lock.json`。

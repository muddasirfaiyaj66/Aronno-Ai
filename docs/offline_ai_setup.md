# Offline AI setup

The full guide — architecture, **grounded prompts**, chat sessions, multimodal Gemma, scan/receipt offline, **standalone APK** vs `dev-client`, and EAS commands — lives here:

**→ [docs/offline_ai/README.md](./offline_ai/README.md)**

### Quick APK (installable, no Expo sandbox)

```bash
cd mobile
eas build --platform android --profile development
```

Hot-reload shell only: `--profile dev-client`.

Mobile quick start: [mobile/README.md](../mobile/README.md).

Payments, delivery fees, and the website admin monitor: [SETUP.md](../SETUP.md).

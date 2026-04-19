export const envTemplate = (): string => `PIE_ENABLE_RENDERING_LOG=true
PIE_API_SERVER=http://localhost:8008/
PIE_CENTRIFUGE_SERVER=wss://localhost:8000/connection/websocket

NEXT_PUBLIC_PIE_ENABLE_RENDERING_LOG=true
NEXT_PUBLIC_PIE_API_SERVER=http://localhost:8008/
NEXT_PUBLIC_PIE_CENTRIFUGE_SERVER=wss://localhost:8000/connection/websocket
`

# AI Realtime Audio Assistant

A real-time voice AI assistant powered by OpenAI's Realtime API with Twilio integration and MCP (Model Context Protocol) support for extensible tool capabilities.

## Features

- **Real-time Voice Interaction**: Speech-to-speech conversation with low latency
- **Twilio Integration**: Connect via phone calls
- **MCP Tool Support**: Extensible tool system for weather, file operations, databases, and more
- **WebSocket Proxy**: Bridges Twilio media streams with OpenAI Realtime API
- **Customizable Voice & Personality**: Configure voice and system prompts

## Prerequisites

- Node.js 18+
- OpenAI API key with Realtime API access
- (Optional) Twilio account with phone number for phone integration
- (Optional) ngrok or similar tool for local development

## Quick Start

1. **Clone and Install**
   ```bash
   npm install
   ```

2. **Configure Environment**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and add your OpenAI API key:
   ```
   OPENAI_API_KEY=your_openai_api_key_here
   ```

3. **Run the Server**
   ```bash
   npm start
   # or for development with auto-reload:
   npm run dev
   ```

   Server will start on `http://localhost:5050`

## Configuration

### Basic Configuration

- `OPENAI_API_KEY`: Your OpenAI API key (required)
- `PORT`: Server port (default: 5050)
- `VOICE`: Voice selection - alloy, echo, or shimmer (default: alloy)
- `SYSTEM_MESSAGE`: Customize the AI assistant's personality

### Twilio Configuration (Optional)

For phone integration:

1. Set up Twilio environment variables in `.env`:
   ```
   TWILIO_ACCOUNT_SID=your_account_sid
   TWILIO_AUTH_TOKEN=your_auth_token
   TWILIO_PHONE_NUMBER=your_phone_number
   ```

2. Configure your Twilio phone number's webhook:
   - Voice webhook: `https://your-domain/incoming-call`
   - Method: POST

3. For local development, use ngrok:
   ```bash
   ngrok http 5050
   ```
   Then use the ngrok URL for your Twilio webhook.

### MCP Tool Integration

The server supports MCP (Model Context Protocol) for extending the AI with tools.

**Enable MCP Servers:**

1. Edit `.env` and specify which servers to use:
   ```
   MCP_SERVERS=weather,memory
   ```

2. Configure each server command:
   ```
   MCP_WEATHER_COMMAND=npx -y @modelcontextprotocol/server-weather
   MCP_MEMORY_COMMAND=npx -y @modelcontextprotocol/server-memory
   ```

**Available MCP Servers:**

- `@modelcontextprotocol/server-weather`: Weather information
- `@modelcontextprotocol/server-memory`: Persistent memory across conversations
- `@modelcontextprotocol/server-filesystem`: File system operations
- `@modelcontextprotocol/server-sqlite`: SQLite database queries
- `@modelcontextprotocol/server-github`: GitHub API operations
- `@modelcontextprotocol/server-brave-search`: Web search

See `mcp-config.example.json` for more examples.

## Usage

### Testing Without Twilio

You can test the WebSocket connection directly:

```bash
# Connect to the WebSocket endpoint
wscat -c ws://localhost:5050/media-stream
```

### With Twilio

Call your Twilio phone number and start talking to the AI assistant!

## Architecture

```
Phone Call → Twilio → WebSocket (media-stream) → Server → OpenAI Realtime API
                                                      ↓
                                                 MCP Servers (tools)
```

The server:
1. Receives audio from Twilio via WebSocket
2. Forwards audio to OpenAI Realtime API
3. Handles tool calls via MCP servers
4. Streams AI responses back to Twilio

## API Endpoints

- `GET /`: Health check and status
- `POST /incoming-call`: Twilio webhook for incoming calls (returns TwiML)
- `WS /media-stream`: WebSocket endpoint for audio streaming

## Development

```bash
# Run with auto-reload
npm run dev

# View logs
# The server logs all events for debugging
```

## Troubleshooting

**"Missing OPENAI_API_KEY"**
- Ensure `.env` file exists and contains your OpenAI API key

**MCP server not starting**
- Check that the command is correct in `.env`
- Ensure the MCP server package is accessible (npx will auto-install)
- Check server logs for specific error messages

**No audio in Twilio calls**
- Verify webhook URL is publicly accessible
- Check that WebSocket URL in TwiML matches your server
- Ensure OpenAI API key has Realtime API access

## Resources

- [OpenAI Realtime API Documentation](https://platform.openai.com/docs/guides/realtime)
- [Twilio Media Streams](https://www.twilio.com/docs/voice/media-streams)
- [Model Context Protocol](https://modelcontextprotocol.io/)

## License

ISC

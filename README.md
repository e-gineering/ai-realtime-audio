# AI Realtime Audio Assistant - Scaffolding Inspection

A real-time voice AI assistant for conducting scaffolding safety inspections by phone, powered by OpenAI's Realtime API with Twilio integration, SQLite database storage, and Docker deployment.

## Features

- **Real-time Voice Interaction**: Speech-to-speech conversation with low latency
- **Structured Data Collection**: Tag identifier, inspector name, location, pass/fail, and comments
- **SQLite Database**: Persistent storage of all inspection records
- **Twilio Integration**: Connect via phone calls
- **Caller Recognition**: Automatically remembers and greets returning callers by name
- **REST API**: Query inspections by tag, location, result, or get statistics
- **Docker Support**: Easy deployment with Docker Compose
- **MCP Tool Support**: Extensible tool system for additional capabilities
- **Interrupt Capable**: Users can interrupt the AI mid-response

## Prerequisites

### Option 1: Docker (Recommended)
- Docker
- Docker Compose
- OpenAI API key with Realtime API access

### Option 2: Local Development
- Node.js 20+
- OpenAI API key with Realtime API access
- (Optional) Twilio account with phone number for phone integration
- (Optional) ngrok or similar tool for local development

## Quick Start with Docker

1. **Clone and Configure**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and add your OpenAI API key:
   ```
   OPENAI_API_KEY=your_openai_api_key_here
   ```

2. **Build and Run**
   ```bash
   docker compose up -d
   ```

   This will:
   - Build the Docker image
   - Start the container in detached mode
   - Create the `./data` directory for database persistence
   - Expose the server on port 5050

3. **View Logs**
   ```bash
   docker compose logs -f
   ```

4. **Stop the Service**
   ```bash
   docker compose down
   ```

5. **Rebuild After Changes**
   ```bash
   docker compose up -d --build
   ```

The server will be available at `http://localhost:5050`

Database will be persisted in `./data/inspections.db`

## Quick Start (Local Development)

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

4. **Run Tests** (Optional)
   ```bash
   npm test
   ```

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

## Inspection Data API

The application provides REST API endpoints to query inspection data:

### Get All Inspections
```bash
curl http://localhost:5050/inspections
curl http://localhost:5050/inspections?limit=50
```

### Get Inspection by Tag
```bash
curl http://localhost:5050/inspections/tag/TAG-12345
```

### Filter by Result (PASS/FAIL)
```bash
curl http://localhost:5050/inspections/result/FAIL
curl http://localhost:5050/inspections/result/PASS?limit=20
```

### Search by Location
```bash
curl http://localhost:5050/inspections/location/Building%207
```

### Get Statistics
```bash
curl http://localhost:5050/inspections/stats
```

Returns:
```json
{
  "stats": {
    "total": 150,
    "passed": 142,
    "failed": 8,
    "unique_inspectors": 12,
    "unique_locations": 25
  }
}
```

## Database

- **Storage**: SQLite database at `./data/inspections.db`
- **Schema**: 
  - **Inspections table**: Equipment ID, inspector name, location, pass/fail result, comments, phone number, timestamps
  - **Callers table**: Phone number, caller name, first/last call timestamps, total calls
- **Caller Recognition**: Phone numbers are automatically associated with names for personalized greetings
- **Persistence**: Database persisted in Docker volume
- **Backup**: Simply copy the `data/` directory

## Usage

### Inspection Call Flow

1. User calls Twilio number
2. System recognizes returning callers and greets them by name (e.g., "Welcome back, John!")
3. AI: "What's your inspection tag number?" (or equipment location)
4. User provides tag (e.g., "SCAFF-001")
5. AI collects: name, location
6. System saves caller's name for future calls
7. AI asks: "Does the scaffolding pass or fail?"
8. AI asks: "Any concerns to note?"
9. AI submits structured JSON data to database
10. AI: "You may now hang up, or let me know if you'd like to enter another inspection"

## Development

### Testing

The application includes a comprehensive test suite with **112 tests** covering:

- **Database operations** (34 tests) - Including safety checks
- **Equipment management** (36 tests)  
- **Validation logic** (29 tests)
- **Integration workflows** (13 tests)

**Run tests:**
```bash
# Run all tests
npm test

# Run specific test suites
npm run test:database
npm run test:equipment
npm run test:validation
npm run test:integration

# Watch mode for development
npm run test:watch
```

**Test coverage:**
- ✅ 112 passing tests
- ✅ All core modules covered
- ✅ Edge cases and error handling
- ✅ Production safety checks
- ✅ Fast execution (<1 second)

### Project Structure

```
ai-realtime-audio/
├── index.js              # Main server and WebSocket handling
├── database.js           # SQLite database operations
├── equipment.js          # Equipment registry
├── validation.js         # Input validation logic
├── system-prompt.txt     # AI system instructions
├── data/                 # SQLite database storage
├── test/                 # Test suite
│   ├── database.test.js
│   ├── equipment.test.js
│   ├── validation.test.js
│   ├── integration.test.js
│   └── README.md
├── .env                  # Configuration
├── package.json          # Dependencies and scripts
├── Dockerfile            # Docker image definition
└── docker-compose.yml    # Docker Compose configuration
```

### Adding New Tests

When adding new functionality:

1. Add tests in the appropriate test file
2. Run tests to ensure they pass: `npm test`
3. Update documentation if needed

Example test:
```javascript
describe('New Feature', function() {
  it('should do something specific', function() {
    const result = myFunction(input);
    expect(result).to.equal(expected);
  });
});
```

11. User can either hang up or record additional inspections (loops back to step 3)

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

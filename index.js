import Fastify from 'fastify';
import FastifyWS from '@fastify/websocket';
import WebSocket from 'ws';
import dotenv from 'dotenv';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

dotenv.config();

const {
  OPENAI_API_KEY,
  PORT = 5050,
  SYSTEM_MESSAGE = 'You are a helpful AI assistant.',
  VOICE = 'alloy'
} = process.env;

if (!OPENAI_API_KEY) {
  console.error('Missing OPENAI_API_KEY in environment variables');
  process.exit(1);
}

const fastify = Fastify();
fastify.register(FastifyWS);
fastify.register(import('@fastify/formbody'));

const OPENAI_WS_URL = 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01';

// MCP client management
const mcpClients = new Map();

// Initialize MCP servers
async function initializeMCP() {
  const mcpServers = process.env.MCP_SERVERS?.split(',').filter(Boolean) || [];

  for (const serverName of mcpServers) {
    const commandEnvVar = `MCP_${serverName.toUpperCase()}_COMMAND`;
    const command = process.env[commandEnvVar];

    if (!command) {
      console.warn(`No command found for MCP server: ${serverName} (expected ${commandEnvVar})`);
      continue;
    }

    try {
      const [cmd, ...args] = command.split(' ');
      const transport = new StdioClientTransport({
        command: cmd,
        args: args
      });

      const client = new Client({
        name: `realtime-audio-${serverName}`,
        version: '1.0.0'
      }, {
        capabilities: {}
      });

      await client.connect(transport);
      mcpClients.set(serverName, client);
      console.log(`✓ MCP server '${serverName}' initialized`);
    } catch (error) {
      console.error(`Failed to initialize MCP server '${serverName}':`, error.message);
    }
  }
}

// Get available tools from all MCP servers
async function getMCPTools() {
  const allTools = [];

  for (const [serverName, client] of mcpClients.entries()) {
    try {
      const { tools } = await client.listTools();
      for (const tool of tools) {
        allTools.push({
          type: 'function',
          name: `${serverName}_${tool.name}`,
          description: tool.description || '',
          parameters: tool.inputSchema || { type: 'object', properties: {} }
        });
      }
    } catch (error) {
      console.error(`Error listing tools from ${serverName}:`, error.message);
    }
  }

  return allTools;
}

// Call an MCP tool
async function callMCPTool(toolName, args) {
  const [serverName, ...toolNameParts] = toolName.split('_');
  const actualToolName = toolNameParts.join('_');

  const client = mcpClients.get(serverName);
  if (!client) {
    throw new Error(`MCP server '${serverName}' not found`);
  }

  const result = await client.callTool({
    name: actualToolName,
    arguments: args
  });

  return result;
}

// Main WebSocket route for handling Twilio media streams
fastify.register(async (fastify) => {
  fastify.get('/media-stream', { websocket: true }, (connection, req) => {
    console.log('Client connected to /media-stream');

    const openAiWs = new WebSocket(OPENAI_WS_URL, {
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "OpenAI-Beta": "realtime=v1"
      }
    });

    let streamSid = null;

    const sendSessionUpdate = async () => {
      const tools = await getMCPTools();

      const sessionUpdate = {
        type: 'session.update',
        session: {
          turn_detection: { type: 'server_vad' },
          input_audio_format: 'g711_ulaw',
          output_audio_format: 'g711_ulaw',
          voice: VOICE,
          instructions: SYSTEM_MESSAGE,
          modalities: ["text", "audio"],
          temperature: 0.8,
        }
      };

      // Add tools if MCP servers are configured
      if (tools.length > 0) {
        sessionUpdate.session.tools = tools;
        sessionUpdate.session.tool_choice = 'auto';
        console.log(`Configured ${tools.length} MCP tools`);
      }

      console.log('Sending session update:', JSON.stringify(sessionUpdate));
      openAiWs.send(JSON.stringify(sessionUpdate));
    };

    // Handle OpenAI WebSocket open
    openAiWs.on('open', () => {
      console.log('Connected to OpenAI Realtime API');
      setTimeout(sendSessionUpdate, 250);
    });

    // Handle messages from OpenAI
    openAiWs.on('message', async (data) => {
      try {
        const response = JSON.parse(data);

        // Log all events for debugging
        if (response.type !== 'response.audio.delta') {
          console.log(`OpenAI Event: ${response.type}`, response);
        }

        // Handle function calls from OpenAI
        if (response.type === 'response.function_call_arguments.done') {
          const { call_id, name, arguments: args } = response;
          console.log(`Function call: ${name}`, args);

          try {
            const result = await callMCPTool(name, JSON.parse(args));

            // Send function result back to OpenAI
            openAiWs.send(JSON.stringify({
              type: 'conversation.item.create',
              item: {
                type: 'function_call_output',
                call_id: call_id,
                output: JSON.stringify(result)
              }
            }));

            // Request a new response
            openAiWs.send(JSON.stringify({ type: 'response.create' }));
          } catch (error) {
            console.error('Error calling MCP tool:', error);
            openAiWs.send(JSON.stringify({
              type: 'conversation.item.create',
              item: {
                type: 'function_call_output',
                call_id: call_id,
                output: JSON.stringify({ error: error.message })
              }
            }));
          }
        }

        // Forward audio back to Twilio
        if (response.type === 'response.audio.delta' && response.delta) {
          const audioDelta = {
            event: 'media',
            streamSid: streamSid,
            media: { payload: response.delta }
          };
          connection.send(JSON.stringify(audioDelta));
        }
      } catch (error) {
        console.error('Error processing OpenAI message:', error);
      }
    });

    // Handle messages from Twilio
    connection.on('message', (message) => {
      try {
        const data = JSON.parse(message);

        switch (data.event) {
          case 'media':
            if (openAiWs.readyState === WebSocket.OPEN) {
              const audioAppend = {
                type: 'input_audio_buffer.append',
                audio: data.media.payload
              };
              openAiWs.send(JSON.stringify(audioAppend));
            }
            break;
          case 'start':
            streamSid = data.start.streamSid;
            console.log('Incoming stream started:', streamSid);
            break;
          default:
            console.log('Received non-media event:', data.event);
            break;
        }
      } catch (error) {
        console.error('Error parsing Twilio message:', error);
      }
    });

    // Handle connection close
    connection.on('close', () => {
      if (openAiWs.readyState === WebSocket.OPEN) {
        openAiWs.close();
      }
      console.log('Client disconnected');
    });

    // Handle OpenAI WebSocket close
    openAiWs.on('close', () => {
      console.log('Disconnected from OpenAI Realtime API');
    });

    // Handle errors
    openAiWs.on('error', (error) => {
      console.error('OpenAI WebSocket error:', error);
    });
  });
});

// Incoming call webhook - returns TwiML
fastify.post('/incoming-call', async (request, reply) => {
  const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
      <Connect>
        <Stream url="wss://${request.headers.host}/media-stream" />
      </Connect>
    </Response>`;

  reply.type('text/xml').send(twimlResponse);
});

// Health check endpoint
fastify.get('/', async (request, reply) => {
  const mcpStatus = Array.from(mcpClients.keys());
  return {
    status: 'ok',
    message: 'AI Realtime Audio Server',
    mcpServers: mcpStatus.length > 0 ? mcpStatus : 'none configured'
  };
});

// Start the server
async function start() {
  try {
    // Initialize MCP servers first
    await initializeMCP();

    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`\n🚀 Server is listening on port ${PORT}`);
    console.log(`📞 Twilio webhook URL: http://your-domain/incoming-call`);
    console.log(`🔌 WebSocket endpoint: ws://your-domain/media-stream`);

    if (mcpClients.size > 0) {
      console.log(`🔧 MCP servers active: ${Array.from(mcpClients.keys()).join(', ')}`);
    } else {
      console.log('ℹ️  No MCP servers configured (add MCP_SERVERS to .env)');
    }
  } catch (err) {
    console.error('Error starting server:', err);
    process.exit(1);
  }
}

start();

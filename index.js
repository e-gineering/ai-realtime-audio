import Fastify from 'fastify';
import FastifyWS from '@fastify/websocket';
import FastifyBasicAuth from '@fastify/basic-auth';
import WebSocket from 'ws';
import { readFileSync } from 'fs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import {
  initializeDatabase,
  createInspection,
  getInspectionByStreamSid,
  getInspectionByEquipmentId,
  saveInspectionData,
  completeInspection,
  getAllInspections,
  getInspectionsByResult,
  getInspectionsByLocation,
  getInspectionStats,
  closeDatabase,
  getCallerByPhoneNumber,
  saveCallerName
} from './database.js';
import {
  getAllEquipment,
  getEquipmentById,
  searchEquipmentByLocation,
  getEquipmentByStatus,
  getEquipmentStats
} from './equipment.js';

const {
  OPENAI_API_KEY,
  PORT = 5050,
  SYSTEM_MESSAGE_FILE = './system-prompt.txt',
  VOICE = 'alloy',
  OPENAI_MODEL = 'gpt-realtime',
  BASIC_AUTH_USER = 'admin',
  BASIC_AUTH_PASS = 'changeme'
} = process.env;

let SYSTEM_MESSAGE = 'You are a helpful AI assistant.';
const systemPromptPath = SYSTEM_MESSAGE_FILE;
try {
  SYSTEM_MESSAGE = readFileSync(systemPromptPath, 'utf-8').trim();
} catch (error) {
  // Will log after fastify is initialized
}

if (!OPENAI_API_KEY) {
  console.error('Missing OPENAI_API_KEY in environment variables');
  process.exit(1);
}

const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    transport: process.env.NODE_ENV !== 'production' ? {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss',
        ignore: 'pid,hostname'
      }
    } : undefined
  }
});

fastify.register(FastifyWS);
fastify.register(import('@fastify/formbody'));

// Register basic auth
fastify.register(FastifyBasicAuth, {
  validate(username, password, req, reply, done) {
    if (username === BASIC_AUTH_USER && password === BASIC_AUTH_PASS) {
      done();
    } else {
      done(new Error('Invalid credentials'));
    }
  },
  authenticate: true
});

const OPENAI_WS_URL = `wss://api.openai.com/v1/realtime?model=${OPENAI_MODEL}`;

// Timing constants for session and message handling.
// These values are defaults chosen based on observed network and system latency in typical deployments.
// Adjust via environment variables to tune for your environment.

// Delay after session update before sending greeting (ms)
const SESSION_UPDATE_DELAY_MS = Number(process.env.SESSION_UPDATE_DELAY_MS) || 250;
// Additional delay after session update to ensure session is ready (ms)
const GREETING_DELAY_OFFSET_MS = Number(process.env.GREETING_DELAY_OFFSET_MS) || 100;
// Delay between WebSocket messages to ensure proper ordering (ms)
const MESSAGE_SEQUENCE_DELAY_MS = Number(process.env.MESSAGE_SEQUENCE_DELAY_MS) || 50;
// Combined delay to ensure session is configured before greeting (ms)
const TOTAL_GREETING_DELAY_MS = SESSION_UPDATE_DELAY_MS + GREETING_DELAY_OFFSET_MS;
// MCP client management
const mcpClients = new Map();

// Initialize MCP servers
async function initializeMCP(logger) {
  const mcpServers = process.env.MCP_SERVERS?.split(',').filter(Boolean) || [];

  for (const serverName of mcpServers) {
    const commandEnvVar = `MCP_${serverName.toUpperCase()}_COMMAND`;
    const command = process.env[commandEnvVar];

    if (!command) {
      logger.warn(`No command found for MCP server: ${serverName} (expected ${commandEnvVar})`);
      continue;
    }

    try {
      // Parse command string respecting quoted arguments
      const args = [];
      let current = '';
      let inQuote = false;
      let quoteChar = '';

      for (let i = 0; i < command.length; i++) {
        const char = command[i];

        if ((char === '"' || char === "'") && !inQuote) {
          inQuote = true;
          quoteChar = char;
        } else if (char === quoteChar && inQuote) {
          inQuote = false;
          quoteChar = '';
        } else if (char === ' ' && !inQuote) {
          if (current) {
            args.push(current);
            current = '';
          }
        } else {
          current += char;
        }
      }

      if (current) {
        args.push(current);
      }

      const [cmd, ...cmdArgs] = args;
      const transport = new StdioClientTransport({
        command: cmd,
        args: cmdArgs
      });

      const client = new Client({
        name: `realtime-audio-${serverName}`,
        version: '1.0.0'
      }, {
        capabilities: {}
      });

      await client.connect(transport);
      mcpClients.set(serverName, client);
      logger.info(`MCP server '${serverName}' initialized`);
    } catch (error) {
      logger.error(`Failed to initialize MCP server '${serverName}': ${error.message}`);
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
      fastify.log.error(`Error listing tools from ${serverName}: ${error.message}`);
    }
  }

  allTools.push({
    type: 'function',
    name: 'get_equipment_info',
    description: 'Look up equipment information from the registry by equipment ID. Use this to verify equipment exists and get its details before conducting an inspection.',
    parameters: {
      type: 'object',
      properties: {
        equipment_id: {
          type: 'string',
          description: 'Equipment ID to look up (e.g., "SCAFF-001")'
        }
      },
      required: ['equipment_id']
    }
  });

  allTools.push({
    type: 'function',
    name: 'search_equipment_by_location',
    description: 'Search for equipment by location name. Useful when the inspector knows the location but not the specific equipment ID.',
    parameters: {
      type: 'object',
      properties: {
        location: {
          type: 'string',
          description: 'Location to search for (e.g., "Warehouse A", "Building B")'
        }
      },
      required: ['location']
    }
  });

  allTools.push({
    type: 'function',
    name: 'save_caller_name',
    description: 'Save the caller\'s name associated with their phone number for future calls. Call this when you first learn the inspector\'s name.',
    parameters: {
      type: 'object',
      properties: {
        caller_name: {
          type: 'string',
          description: 'The name of the caller/inspector'
        }
      },
      required: ['caller_name']
    }
  });

  allTools.push({
    type: 'function',
    name: 'submit_inspection_data',
    description: 'Submit structured scaffolding inspection data in JSON format. Must be called before ending the call. The equipment_id must reference a valid equipment ID from the registry.',
    parameters: {
      type: 'object',
      properties: {
        equipment_id: {
          type: 'string',
          description: 'Equipment ID from the registry (e.g., "SCAFF-001"). Must be validated using get_equipment_info first.'
        },
        inspector_name: {
          type: 'string',
          description: 'Name of the person conducting the inspection'
        },
        location: {
          type: 'string',
          description: 'Location or site of the scaffolding'
        },
        inspection_result: {
          type: 'string',
          enum: ['PASS', 'FAIL'],
          description: 'Overall inspection result - must be exactly "PASS" or "FAIL"'
        },
        comments: {
          type: 'string',
          description: 'Any additional comments, concerns, or observations from the inspection'
        }
      },
      required: ['equipment_id', 'inspector_name', 'location', 'inspection_result']
    }
  });

  allTools.push({
    type: 'function',
    name: 'end_call',
    description: 'End the phone call. Can only be called AFTER successfully submitting inspection data via submit_inspection_data.',
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Brief reason for ending the call (e.g., "inspection_complete", "user_requested")'
        }
      },
      required: ['reason']
    }
  });

  return allTools;
}

// Validate inspection data
function validateInspectionData(data) {
  const errors = [];
  
  if (!data.equipment_id || data.equipment_id.trim() === '') {
    errors.push('equipment_id is required');
  } else {
    const equipment = getEquipmentById(data.equipment_id);
    if (!equipment) {
      errors.push(`equipment_id "${data.equipment_id}" not found in registry`);
    }
  }
  
  if (!data.inspector_name || data.inspector_name.trim() === '') {
    errors.push('inspector_name is required');
  }
  
  if (!data.location || data.location.trim() === '') {
    errors.push('location is required');
  }
  
  if (!data.inspection_result) {
    errors.push('inspection_result is required');
  } else if (data.inspection_result !== 'PASS' && data.inspection_result !== 'FAIL') {
    errors.push('inspection_result must be exactly "PASS" or "FAIL"');
  }
  
  return {
    valid: errors.length === 0,
    errors: errors
  };
}

// Call an MCP tool or built-in function
async function callMCPTool(toolName, args, context = {}) {
  if (toolName === 'save_caller_name') {
    const { phoneNumber } = context;

    if (!phoneNumber) {
      return {
        success: false,
        error: 'No phone number available',
        message: 'Cannot save caller name without phone number'
      };
    }

    if (!args.caller_name || args.caller_name.trim() === '') {
      return {
        success: false,
        error: 'Caller name is required',
        message: 'Please provide a valid name'
      };
    }

    try {
      saveCallerName(phoneNumber, args.caller_name.trim());
      fastify.log.info({ callerName: args.caller_name, phoneNumber }, 'Saved caller name');

      return {
        success: true,
        message: `Name saved successfully`,
        caller_name: args.caller_name.trim()
      };
    } catch (error) {
      fastify.log.error({ error }, 'Error saving caller name');
      return {
        success: false,
        error: 'Database error',
        message: 'Failed to save caller name'
      };
    }
  }
  
  if (toolName === 'get_equipment_info') {
    const equipment = getEquipmentById(args.equipment_id);
    
    if (!equipment) {
      return {
        success: false,
        error: 'Equipment not found',
        message: `Equipment ID "${args.equipment_id}" not found in registry. Please verify the equipment ID.`
      };
    }
    
    return {
      success: true,
      equipment: equipment,
      message: `Found equipment: ${equipment.type} at ${equipment.location}`
    };
  }
  
  if (toolName === 'search_equipment_by_location') {
    const results = searchEquipmentByLocation(args.location);
    
    if (results.length === 0) {
      return {
        success: false,
        message: `No equipment found at location "${args.location}"`
      };
    }
    
    return {
      success: true,
      equipment: results,
      count: results.length,
      message: `Found ${results.length} equipment item(s) at "${args.location}"`
    };
  }
  
  if (toolName === 'submit_inspection_data') {
    const validation = validateInspectionData(args);
    
    if (!validation.valid) {
      return {
        success: false,
        error: 'Validation failed',
        details: validation.errors,
        message: 'Please provide all required fields: ' + validation.errors.join(', ')
      };
    }
    
    try {
      saveInspectionData(context.streamSid, args);
      fastify.log.info({ inspectionData: args, streamSid: context.streamSid }, 'Inspection data submitted and saved');

      context.inspectionSubmitted = true;
      context.inspectionData = args;

      return {
        success: true,
        message: 'Inspection data successfully recorded',
        data: args
      };
    } catch (error) {
      fastify.log.error({ error, streamSid: context.streamSid }, 'Database save error');
      return {
        success: false,
        error: 'Database error',
        message: 'Failed to save inspection data. Please try again.'
      };
    }
  }
  
  if (toolName === 'end_call') {
    if (!context.inspectionSubmitted) {
      return {
        success: false,
        error: 'Cannot end call without submitting inspection data first',
        message: 'You must call submit_inspection_data before ending the call'
      };
    }
    
    return {
      success: true,
      message: 'Call will be ended',
      reason: args.reason || 'unknown'
    };
  }

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
    fastify.log.info('Client connected to /media-stream');

    // Phone number will be extracted from Twilio's start event customParameters
    let phoneNumber = null;
    let returningCaller = null;

    const openAiWs = new WebSocket(OPENAI_WS_URL, {
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "OpenAI-Beta": "realtime=v1"
      }
    });

    let streamSid = null;
    let isAIResponding = false;
    let inspectionSubmitted = false;
    let inspectionData = null;

    const sendSessionUpdate = async () => {
      const tools = await getMCPTools();

      const sessionUpdate = {
        type: 'session.update',
        session: {
          turn_detection: { 
            type: 'server_vad',
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 200
          },
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
        fastify.log.debug({ toolCount: tools.length }, 'Configured MCP tools');
      }

      fastify.log.debug('Sending session update');
      openAiWs.send(JSON.stringify(sessionUpdate));

      // Greeting will be sent after we receive the 'start' event and extract phone number
    };

    // Handle OpenAI WebSocket open
    openAiWs.on('open', () => {
      fastify.log.info('Connected to OpenAI Realtime API');
      // Session update will be sent after receiving session.created event
    });

    // Handle messages from OpenAI
    openAiWs.on('message', async (data) => {
      try {
        const response = JSON.parse(data);

        // Log all events for debugging
        if (response.type !== 'response.audio.delta') {
          fastify.log.debug({ event: response.type, data: response }, 'OpenAI event');
        }

        // Send session update when session is created
        if (response.type === 'session.created') {
          await sendSessionUpdate();
        }

        // Handle function calls from OpenAI
        if (response.type === 'response.function_call_arguments.done') {
          const { call_id, name, arguments: args } = response;
          fastify.log.info({ functionName: name, args }, 'Function call');

          try {
            let parsedArgs;
            try {
              parsedArgs = JSON.parse(args);
            } catch (parseError) {
              throw new Error(`Invalid JSON arguments: ${parseError.message}`);
            }

            const context = {
              inspectionSubmitted,
              inspectionData,
              streamSid,
              phoneNumber
            };

            const result = await callMCPTool(name, parsedArgs, context);

            if (name === 'submit_inspection_data' && result.success) {
              inspectionSubmitted = true;
              inspectionData = parsedArgs;
              fastify.log.info('Inspection data validated and stored');
            }

            // Send function result back to OpenAI
            openAiWs.send(JSON.stringify({
              type: 'conversation.item.create',
              item: {
                type: 'function_call_output',
                call_id: call_id,
                output: JSON.stringify(result)
              }
            }));

            // Handle end_call function
            if (name === 'end_call' && result.success) {
              fastify.log.info({ reason: parsedArgs.reason }, 'Call ending requested');

              // Send a final message asking AI to say goodbye
              setTimeout(() => {
                openAiWs.send(JSON.stringify({ type: 'response.create' }));
              }, MESSAGE_SEQUENCE_DELAY_MS);
              
              // Wait for AI response to complete, then hang up
              setTimeout(() => {
                if (streamSid && connection.readyState === connection.OPEN) {
                  const hangupMessage = {
                    event: 'clear',
                    streamSid: streamSid
                  };
                  connection.send(JSON.stringify(hangupMessage));
                  connection.close();
                  fastify.log.info('Call ended');
                }
              }, 3000);
            } else {
              // Request a new response for non-hangup functions
              setTimeout(() => {
                openAiWs.send(JSON.stringify({ type: 'response.create' }));
              }, MESSAGE_SEQUENCE_DELAY_MS);
            }
          } catch (error) {
            fastify.log.error({ error, functionName: name }, 'Error calling MCP tool');
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

        // Track AI response state for interruption handling
        if (response.type === 'response.audio.start') {
          isAIResponding = true;
        }
        if (response.type === 'response.audio.done') {
          isAIResponding = false;
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
        fastify.log.error({ error }, 'Error processing OpenAI message');
      }
    });

    // Handle messages from Twilio
    connection.on('message', (message) => {
      try {
        const data = JSON.parse(message);

        switch (data.event) {
          case 'media':
            if (openAiWs.readyState === WebSocket.OPEN) {
              if (isAIResponding) {
                openAiWs.send(JSON.stringify({ type: 'response.cancel' }));
                setTimeout(() => {
                  openAiWs.send(JSON.stringify({ type: 'input_audio_buffer.clear' }));
                }, MESSAGE_SEQUENCE_DELAY_MS);
                isAIResponding = false;
              }
              
              const audioAppend = {
                type: 'input_audio_buffer.append',
                audio: data.media.payload
              };
              openAiWs.send(JSON.stringify(audioAppend));
            }
            break;
          case 'start':
            streamSid = data.start.streamSid;
            fastify.log.info({ streamSid }, 'Incoming stream started');

            // Extract phone number from Twilio customParameters
            if (data.start.customParameters?.phone) {
              phoneNumber = data.start.customParameters.phone;
              fastify.log.info({ phoneNumber }, 'Caller phone number');

              // Check if this is a returning caller
              returningCaller = getCallerByPhoneNumber(phoneNumber);
              if (returningCaller && returningCaller.caller_name) {
                fastify.log.info({ callerName: returningCaller.caller_name }, 'Returning caller detected');
              }
            }

            createInspection(streamSid, phoneNumber);
            fastify.log.info({ streamSid }, 'New inspection record created');

            // Send initial greeting based on caller status
            // Wait for OpenAI WebSocket to be ready before sending greeting
            const sendGreeting = () => {
              if (openAiWs.readyState === WebSocket.OPEN) {
                let greetingText;
                if (returningCaller && returningCaller.caller_name) {
                  greetingText = `This is a returning caller named ${returningCaller.caller_name}. Welcome them back warmly and invite them to begin a scaffolding inspection. DO NOT ask for their name - use ${returningCaller.caller_name} for the inspector_name field.`;
                } else {
                  greetingText = 'This is a new caller. Please greet them and invite them to begin a scaffolding inspection. You will need to ask for their name.';
                }

                const initialMessage = {
                  type: 'conversation.item.create',
                  item: {
                    type: 'message',
                    role: 'user',
                    content: [
                      {
                        type: 'input_text',
                        text: greetingText
                      }
                    ]
                  }
                };
                openAiWs.send(JSON.stringify(initialMessage));

                // Trigger AI response after a small delay to ensure proper message sequencing
                setTimeout(() => {
                  openAiWs.send(JSON.stringify({ type: 'response.create' }));
                }, MESSAGE_SEQUENCE_DELAY_MS);
              } else {
                // If WebSocket not ready yet, wait and retry
                setTimeout(sendGreeting, 100);
              }
            };

            setTimeout(sendGreeting, GREETING_DELAY_OFFSET_MS);
            break;
          default:
            fastify.log.debug({ event: data.event }, 'Received non-media event');
            break;
        }
      } catch (error) {
        fastify.log.error({ error }, 'Error parsing Twilio message');
      }
    });

    // Handle connection close
    connection.on('close', () => {
      if (openAiWs.readyState === WebSocket.OPEN) {
        openAiWs.close();
      }

      if (streamSid) {
        completeInspection(streamSid);
        fastify.log.info({ streamSid }, 'Inspection call completed');
      }

      fastify.log.info('Client disconnected');
    });

    // Handle OpenAI WebSocket close
    openAiWs.on('close', () => {
      fastify.log.info('Disconnected from OpenAI Realtime API');
    });

    // Handle errors
    openAiWs.on('error', (error) => {
      fastify.log.error({ error }, 'OpenAI WebSocket error');
    });
  });
});

// Incoming call webhook - returns TwiML
fastify.post('/incoming-call', async (request, reply) => {
  // Twilio sends the caller's phone number in the 'From' parameter
  const callerPhoneNumber = request.body.From || null;
  fastify.log.info({ callerPhoneNumber }, 'Incoming call');

  // Check if this is a returning caller
  let callerInfo = null;
  if (callerPhoneNumber) {
    callerInfo = getCallerByPhoneNumber(callerPhoneNumber);
    if (callerInfo) {
      fastify.log.info({ callerName: callerInfo.caller_name || 'Name not set' }, 'Returning caller');
    } else {
      fastify.log.info('New caller');
    }
  }
  
  // Pass caller info via Twilio Stream parameters
  const parameterXml = callerPhoneNumber
    ? `<Parameter name="phone" value="${callerPhoneNumber}" />`
    : '';

  const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
      <Connect>
        <Stream url="wss://${request.headers.host}/media-stream">
          ${parameterXml}
        </Stream>
      </Connect>
    </Response>`;

  reply.type('text/xml').send(twimlResponse);
});

// Health check endpoint
fastify.get('/', async (request, reply) => {
  const mcpStatus = Array.from(mcpClients.keys());
  const stats = getInspectionStats();
  const equipmentStats = getEquipmentStats();
  return {
    status: 'ok',
    message: 'AI Realtime Audio Server - Scaffolding Inspection',
    mcpServers: mcpStatus.length > 0 ? mcpStatus : 'none configured',
    database: stats,
    equipment: equipmentStats
  };
});

// API endpoint to get all inspections
fastify.get('/inspections', { onRequest: fastify.basicAuth }, async (request, reply) => {
  const limit = parseInt(request.query.limit) || 100;
  const inspections = getAllInspections(limit);
  return { inspections, count: inspections.length };
});

// API endpoint to get inspection by tag
fastify.get('/inspections/equipment/:equipmentId', { onRequest: fastify.basicAuth }, async (request, reply) => {
  const inspections = getInspectionByEquipmentId(request.params.equipmentId);
  return { inspections, count: inspections.length };
});

// API endpoint to get inspections by result
fastify.get('/inspections/result/:result', { onRequest: fastify.basicAuth }, async (request, reply) => {
  const result = request.params.result.toUpperCase();
  if (result !== 'PASS' && result !== 'FAIL') {
    reply.code(400).send({ error: 'Result must be PASS or FAIL' });
    return;
  }
  const limit = parseInt(request.query.limit) || 100;
  const inspections = getInspectionsByResult(result, limit);
  return { inspections, count: inspections.length, result };
});

// API endpoint to search inspections by location
fastify.get('/inspections/location/:location', { onRequest: fastify.basicAuth }, async (request, reply) => {
  const limit = parseInt(request.query.limit) || 100;
  const inspections = getInspectionsByLocation(request.params.location, limit);
  return { inspections, count: inspections.length };
});

// API endpoint to get statistics
fastify.get('/inspections/stats', { onRequest: fastify.basicAuth }, async (request, reply) => {
  const stats = getInspectionStats();
  return { stats };
});

fastify.get('/equipment', { onRequest: fastify.basicAuth }, async (request, reply) => {
  const equipment = getAllEquipment();
  return { equipment, count: equipment.length };
});

fastify.get('/equipment/:equipmentId', { onRequest: fastify.basicAuth }, async (request, reply) => {
  const equipment = getEquipmentById(request.params.equipmentId);
  if (!equipment) {
    reply.code(404).send({ error: 'Equipment not found' });
    return;
  }
  return { equipment };
});

fastify.get('/equipment/location/:location', { onRequest: fastify.basicAuth }, async (request, reply) => {
  const equipment = searchEquipmentByLocation(request.params.location);
  return { equipment, count: equipment.length };
});

fastify.get('/equipment/stats', { onRequest: fastify.basicAuth }, async (request, reply) => {
  const stats = getEquipmentStats();
  return { stats };
});

// Start the server
async function start() {
  try {
    // Initialize database first
    initializeDatabase();

    // Initialize MCP servers
    await initializeMCP(fastify.log);

    await fastify.listen({ port: PORT, host: '0.0.0.0' });

    fastify.log.info(`Server is listening on port ${PORT}`);
    fastify.log.info('API endpoints available:');
    fastify.log.info('  GET  /inspections - List all inspections');
    fastify.log.info('  GET  /inspections/equipment/:equipmentId - Get inspections by equipment ID');
    fastify.log.info('  GET  /inspections/result/:result - Filter by PASS/FAIL');
    fastify.log.info('  GET  /inspections/location/:location - Search by location');
    fastify.log.info('  GET  /inspections/stats - Get statistics');
    fastify.log.info('  GET  /equipment - List all equipment');
    fastify.log.info('  GET  /equipment/:equipmentId - Get equipment by ID');
    fastify.log.info('  GET  /equipment/location/:location - Search equipment by location');
    fastify.log.info('  GET  /equipment/stats - Get equipment statistics');

    if (mcpClients.size > 0) {
      fastify.log.info({ servers: Array.from(mcpClients.keys()) }, 'MCP servers active');
    } else {
      fastify.log.info('No MCP servers configured (add MCP_SERVERS to .env)');
    }
  } catch (err) {
    fastify.log.error({ error: err }, 'Error starting server');
    process.exit(1);
  }
}

// Cleanup on exit
process.on('SIGINT', () => {
  fastify.log.info('Shutting down...');
  closeDatabase();
  process.exit(0);
});

process.on('SIGTERM', () => {
  fastify.log.info('Shutting down...');
  closeDatabase();
  process.exit(0);
});

start();
